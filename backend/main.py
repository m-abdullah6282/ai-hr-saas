from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
import os
from routers import auth, jobs, candidates

# .env file load karo
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Supabase client banao (backend ke liye secret key use hoti hai)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

app = FastAPI()

# CORS setup - frontend se requests allow karne ke liye
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth router register karo (signup, login, me endpoints)
app.include_router(auth.router)
# Jobs router register karo (CRUD + public slug endpoint)
app.include_router(jobs.router)
# Candidates router register karo (public apply + protected candidate endpoints)
app.include_router(candidates.router)

@app.get("/")
def root():
    return {"message": "AI HR SaaS backend chal raha hai! "}

@app.get("/test-db")
def test_db():
    # Test karo ke Supabase se connection ho raha hai ya nahi
    try:
        response = supabase.table("companies").select("*").execute()
        return {
            "status": "success",
            "message": "Supabase se connection ho gaya!",
            "data": response.data
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}