import os
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv
from routers.auth import get_current_user

load_dotenv()

# Supabase se connection (service role key — RLS bypass hota hai)
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

router = APIRouter(prefix="/jobs", tags=["jobs"])


# ---- Request body shapes ----
class JobCreate(BaseModel):
    title: str
    description: str | None = None
    requirements: str | None = None
    location: str | None = None
    employment_type: str | None = None  # full-time, part-time, contract, internship
    salary_min: float | None = None
    salary_max: float | None = None
    status: str = "open"                # open / closed
    slug: str | None = None             # nahi diya to title se auto-generate


class JobUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    requirements: str | None = None
    location: str | None = None
    employment_type: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    status: str | None = None
    slug: str | None = None


# ---- Slug auto-generate (title se) ----
def generate_slug(title: str) -> str:
    base = title.lower().strip().replace(" ", "-")
    base = "".join(c for c in base if c.isalnum() or c == "-")
    if not base:
        base = "job"
    return f"{base}-{uuid.uuid4().hex[:6]}"


# ---- Logged-in user ki company nikalo (companies table se) ----
def get_user_company(user):
    try:
        response = supabase.table("companies").select("*").eq("owner_id", user.id).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not response or not response.data:
        raise HTTPException(status_code=404, detail="Company not found for this user")
    return response.data


# ---- 1. CREATE (protected) ----
@router.post("", status_code=201)
def create_job(request: JobCreate, user=Depends(get_current_user)):
    company = get_user_company(user)
    slug = request.slug or generate_slug(request.title)
    try:
        response = supabase.table("jobs").insert({
            "company_id": company["id"],
            "title": request.title,
            "description": request.description,
            "requirements": request.requirements,
            "location": request.location,
            "employment_type": request.employment_type,
            "salary_min": request.salary_min,
            "salary_max": request.salary_max,
            "status": request.status,
            "slug": slug,
        }).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---- 2. LIST (protected) ----
@router.get("")
def list_jobs(user=Depends(get_current_user)):
    company = get_user_company(user)
    try:
        response = supabase.table("jobs").select("*").eq("company_id", company["id"]).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---- 3. GET BY ID (protected) ----
@router.get("/{job_id}")
def get_job(job_id: str, user=Depends(get_current_user)):
    company = get_user_company(user)
    try:
        response = supabase.table("jobs").select("*").eq("id", job_id).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not response or not response.data:
        raise HTTPException(status_code=404, detail="Job not found")
    if response.data["company_id"] != company["id"]:
        raise HTTPException(status_code=403, detail="Not your job")
    return response.data


# ---- 4. UPDATE (protected) ----
@router.put("/{job_id}")
def update_job(job_id: str, request: JobUpdate, user=Depends(get_current_user)):
    company = get_user_company(user)
    try:
        existing = supabase.table("jobs").select("company_id").eq("id", job_id).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Job not found")
    if existing.data["company_id"] != company["id"]:
        raise HTTPException(status_code=403, detail="Not your job")
    payload = {k: v for k, v in request.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="Koi field update karne ke liye bheji nahi gayi")
    payload["updated_at"] = "now()"
    try:
        response = supabase.table("jobs").update(payload).eq("id", job_id).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return response.data[0]


# ---- 5. DELETE (protected) ----
@router.delete("/{job_id}")
def delete_job(job_id: str, user=Depends(get_current_user)):
    company = get_user_company(user)
    try:
        existing = supabase.table("jobs").select("company_id").eq("id", job_id).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Job not found")
    if existing.data["company_id"] != company["id"]:
        raise HTTPException(status_code=403, detail="Not your job")
    try:
        response = supabase.table("jobs").delete().eq("id", job_id).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"message": "Job deleted", "id": job_id}


# ---- 6. PUBLIC SLUG ENDPOINT (koi auth nahi chahiye) ----
@router.get("/public/{slug}")
def get_public_job(slug: str):
    try:
        response = supabase.table("jobs").select("*").eq("slug", slug).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not response or not response.data:
        raise HTTPException(status_code=404, detail="Job not found")
    return response.data