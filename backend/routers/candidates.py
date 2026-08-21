import os
import re
import uuid
import requests
from fastapi import APIRouter, HTTPException, Depends, File, Form, UploadFile
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv
from routers.auth import get_current_user
from routers.jobs import get_user_company
from services.ai_service import extract_text_from_pdf, analyze_resume, generate_interview_questions

load_dotenv()

# Supabase se connection (service role key — RLS bypass hota hai)
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

router = APIRouter(tags=["candidates"])

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_STATUSES = {"applied", "screened", "interview", "hired", "rejected"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---- Request body shape ----
class CandidateStatusUpdate(BaseModel):
    status: str


def is_pdf(content: bytes) -> bool:
    # Har valid PDF file "%PDF" se shuru hoti hai — content_type par bharosa
    # karna risky hai kyunki client use fake bhi bhej sakta hai
    return content.startswith(b"%PDF")


# ---- 1. PUBLIC APPLY ENDPOINT (koi auth nahi chahiye) ----
@router.post("/jobs/{slug}/apply", status_code=201)
async def apply_to_job(
    slug: str,
    name: str = Form(...),
    email: str = Form(...),
    resume: UploadFile = File(...),
):
    # Pehle slug se job dhoondo
    try:
        job = supabase.table("jobs").select("*").eq("slug", slug).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not job or not job.data:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.data["status"] != "open":
        raise HTTPException(status_code=400, detail="Job is not accepting applications right now")

    # ---- Validation ----
    if not EMAIL_RE.match(email.strip()):
        raise HTTPException(status_code=400, detail="Invalid email format")

    file_bytes = await resume.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Resume file is empty")
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Resume file is too large (max 5MB)")
    if resume.content_type != "application/pdf" or not resume.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    if not is_pdf(file_bytes):
        raise HTTPException(status_code=400, detail="File is not a valid PDF")

    # ---- Resume ko Supabase Storage ("resumes" bucket) mein upload karo ----
    safe_filename = os.path.basename(resume.filename).replace(" ", "_")
    storage_path = f"{uuid.uuid4().hex}-{safe_filename}"
    try:
        supabase.storage.from_("resumes").upload(
            storage_path,
            file_bytes,
            {"content-type": "application/pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Resume upload failed: {str(e)}")

    resume_url = supabase.storage.from_("resumes").get_public_url(storage_path)

    # ---- candidates table mein naya row ----
    try:
        response = supabase.table("candidates").insert({
            "name": name.strip(),
            "email": email.strip(),
            "resume_url": resume_url,
            "job_id": job.data["id"],
            "status": "applied",
        }).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---- 2. LIST CANDIDATES (protected) ----
@router.get("/candidates")
def list_candidates(job_id: str, user=Depends(get_current_user)):
    company = get_user_company(user)
    # Ownership check: job current user ki company ki honi chahiye
    try:
        job = supabase.table("jobs").select("company_id").eq("id", job_id).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not job or not job.data:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.data["company_id"] != company["id"]:
        raise HTTPException(status_code=403, detail="Not your job")
    try:
        response = supabase.table("candidates").select("*").eq("job_id", job_id).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---- 3. UPDATE CANDIDATE STATUS (protected) ----
@router.patch("/candidates/{candidate_id}/status")
def update_candidate_status(candidate_id: str, request: CandidateStatusUpdate, user=Depends(get_current_user)):
    if request.status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Allowed values: applied, screened, interview, hired, rejected"
        )
    company = get_user_company(user)
    try:
        candidate = supabase.table("candidates").select("*").eq("id", candidate_id).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not candidate or not candidate.data:
        raise HTTPException(status_code=404, detail="Candidate not found")
    # Ownership check: candidate jis job se linked hai, wo job user ki company ki ho
    try:
        job = supabase.table("jobs").select("company_id").eq("id", candidate.data["job_id"]).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not job or not job.data or job.data["company_id"] != company["id"]:
        raise HTTPException(status_code=403, detail="Not your candidate")
    try:
        response = supabase.table("candidates").update({
            "status": request.status,
            "updated_at": "now()",
        }).eq("id", candidate_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---- 4. AI ANALYZE CANDIDATE (protected) ----
@router.post("/candidates/{candidate_id}/analyze")
def analyze_candidate(candidate_id: str, user=Depends(get_current_user)):
    company = get_user_company(user)

    # Candidate dhoondo
    try:
        candidate = supabase.table("candidates").select("*").eq("id", candidate_id).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not candidate or not candidate.data:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Ownership check: candidate jis job se linked hai, wo job user ki company ki ho
    try:
        job = supabase.table("jobs").select("*").eq("id", candidate.data["job_id"]).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not job or not job.data:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.data["company_id"] != company["id"]:
        raise HTTPException(status_code=403, detail="Not your candidate")

    # Resume download karo (public URL se)
    resume_url = candidate.data.get("resume_url")
    if not resume_url:
        raise HTTPException(status_code=400, detail="Candidate ke paas resume_url nahi hai")
    try:
        resp = requests.get(resume_url, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Resume download fail hui: {str(e)}")

    # PDF se text nikalo
    try:
        resume_text = extract_text_from_pdf(resp.content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Groq se analysis karwao
    try:
        result = analyze_resume(
            resume_text,
            job_title=job.data.get("title") or "",
            job_description=job.data.get("description") or "",
            job_requirements=job.data.get("requirements") or "",
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Results candidates table mein save karo
    try:
        response = supabase.table("candidates").update({
            "parsed_data": result,
            "ai_score": result.get("score"),
            "ai_reasoning": result.get("reasoning"),
            "updated_at": "now()",
        }).eq("id", candidate_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---- 5. AI GENERATE INTERVIEW QUESTIONS (protected) ----
@router.post("/candidates/{candidate_id}/generate-questions")
def generate_questions_for_candidate(candidate_id: str, user=Depends(get_current_user)):
    company = get_user_company(user)

    # Candidate dhoondo
    try:
        candidate = supabase.table("candidates").select("*").eq("id", candidate_id).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not candidate or not candidate.data:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Parsed data bina analyze kiye questions nahi ban sakte
    parsed_data = candidate.data.get("parsed_data")
    if not parsed_data:
        raise HTTPException(status_code=400, detail="Please analyze the resume first")

    # Ownership check: candidate jis job se linked hai, wo job user ki company ki ho
    try:
        job = supabase.table("jobs").select("*").eq("id", candidate.data["job_id"]).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not job or not job.data:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.data["company_id"] != company["id"]:
        raise HTTPException(status_code=403, detail="Not your candidate")

    # Groq se interview questions banwao
    try:
        result = generate_interview_questions(
            parsed_data,
            job_title=job.data.get("title") or "",
            job_description=job.data.get("description") or "",
            job_requirements=job.data.get("requirements") or "",
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Questions candidates table mein save karke updated row wapas do
    try:
        response = supabase.table("candidates").update({
            "interview_questions": result,
            "updated_at": "now()",
        }).eq("id", candidate_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
