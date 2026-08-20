import os
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv
load_dotenv()



# Supabase se connection bana rahe hain (.env se keys padhega)
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)
router = APIRouter(prefix="/auth", tags=["auth"])


# ---- Request body ke liye shapes (jo data frontend se aayega) ----
class SignupRequest(BaseModel):
    email: str
    password: str
    company_name: str

class LoginRequest(BaseModel):
    email: str
    password: str


# ---- SIGNUP ----
@router.post("/signup")
def signup(request: SignupRequest):
    if not request.company_name or not request.company_name.strip():
        raise HTTPException(status_code=400, detail="Company name is required")
    try:
        response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # User ke diye hue company_name se companies table mein company banao
    try:
        company_res = supabase.table("companies").insert({
            "name": request.company_name.strip(),
            "owner_id": response.user.id,
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Company creation failed: {str(e)}")

    return {
        "message": "User created",
        "user": response.user,
        "company": company_res.data[0],
    }


# ---- LOGIN ----
@router.post("/login")
def login(request: LoginRequest):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        return {
            "access_token": response.session.access_token,
            "user": response.user
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---- DEPENDENCY: jo har protected endpoint mein use hogi ----
def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    token = authorization.split(" ")[1]
    try:
        user = supabase.auth.get_user(token)
        return user.user
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---- CURRENT USER ENDPOINT ----
@router.get("/me")
def me(user=Depends(get_current_user)):
    return user