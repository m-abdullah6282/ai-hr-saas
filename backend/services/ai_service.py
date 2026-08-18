import json
import os
from io import BytesIO

from dotenv import load_dotenv
from groq import Groq
from pypdf import PdfReader

load_dotenv()

GROQ_MODEL = "openai/gpt-oss-120b"


# ---- PDF se text nikalo ----
def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as e:
        raise ValueError(f"PDF ko read karte waqt problem hui: {str(e)}")
    if not text.strip():
        raise ValueError("PDF mein koi readable text nahi mila (ho sakta hai ye scanned/image-based PDF ho)")
    return text.strip()


# ---- Resume + job ko Groq (LLaMA) ko bhejo aur structured result lo ----
def analyze_resume(resume_text: str, job_title: str, job_description: str, job_requirements: str) -> dict:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY .env file mein set nahi hai")

    # Client har call par lazily banao — taake import time pe crash na ho
    client = Groq(api_key=api_key)

    system_prompt = (
        "You are a resume analyzer for an AI-powered HR SaaS platform. "
        "You extract structured data from a candidate's resume AND score the candidate "
        "against the given job requirements — all in ONE response.\n\n"
        "Respond with STRICT JSON only, in exactly this format (no extra text, no markdown):\n"
        "{\n"
        '  "name": "string or null",\n'
        '  "email": "string or null",\n'
        '  "skills": ["string"],\n'
        '  "years_experience": number or null,\n'
        '  "score": number (0-100),\n'
        '  "reasoning": "string - 1-2 lines"\n'
        "}\n\n"
        "Rules:\n"
        "- If a field is missing from the resume, return null — never guess or invent data.\n"
        "- Consider related/transferable skills, not just exact keyword matches "
        "(e.g. Flask experience is relevant for a FastAPI role).\n"
        "- score should reflect how well the candidate matches the job requirements (0-100).\n"
        "- reasoning must be a short 1-2 line explanation of the score.\n"
    )

    user_prompt = (
        f"JOB TITLE: {job_title}\n"
        f"JOB DESCRIPTION: {job_description}\n"
        f"JOB REQUIREMENTS: {job_requirements}\n\n"
        f"CANDIDATE RESUME:\n{resume_text}\n\n"
        "Return the analysis as strict JSON only."
    )

    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )
        raw = completion.choices[0].message.content
    except Exception as e:
        raise RuntimeError(f"Groq API call fail hui: {str(e)}")

    # LLM kabhi-kabhi markdown code fences mein JSON wrap kar deta hai
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        data = json.loads(raw)
    except Exception as e:
        raise RuntimeError(f"LLM ne invalid JSON return kiya: {str(e)}")

    if not isinstance(data, dict):
        raise RuntimeError("LLM ne JSON object return nahi kiya")

    return _sanitize_result(data)


# ---- LLM ka output clean/safe karo (kabhi kabhi missing ya galat type deta hai) ----
def _sanitize_result(data: dict) -> dict:
    name = data.get("name")
    email = data.get("email")
    reasoning = data.get("reasoning")

    skills = data.get("skills")
    if not isinstance(skills, list):
        skills = []
    skills = [str(s).strip() for s in skills if str(s).strip()]

    years = data.get("years_experience")
    if years is None or isinstance(years, bool) or not isinstance(years, (int, float)):
        years = None
    else:
        years = float(years)

    score = data.get("score")
    if score is None or isinstance(score, bool) or not isinstance(score, (int, float)):
        score = 0
    score = max(0, min(100, int(round(score))))

    return {
        "name": name if isinstance(name, str) and name.strip() else None,
        "email": email if isinstance(email, str) and email.strip() else None,
        "skills": skills,
        "years_experience": years,
        "score": score,
        "reasoning": reasoning if isinstance(reasoning, str) and reasoning.strip() else None,
    }