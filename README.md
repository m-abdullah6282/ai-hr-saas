# AI HR Recruitment SaaS

An AI-powered hiring platform built for small startups that don't have a dedicated HR team. Post jobs, let candidates apply through a public link, track them through a hiring pipeline, and (coming soon) let AI screen and rank resumes automatically.

Built in public — [follow the journey on LinkedIn](#).

## 🚧 Project Status

This is an active work in progress. Currently in **Phase 1 — Core Backbone**.

- [x] Auth (signup, login, JWT-protected routes)
- [x] Jobs CRUD (create, list, update, delete, public listing)
- [x] Candidates & Applications (public apply with resume upload, protected listing, status updates)
- [ ] AI resume parsing & ranking (Groq / LLaMA)
- [ ] Frontend (React dashboard, public apply page, Kanban pipeline)
- [ ] Multi-tenant SaaS layer + payments

## 🛠️ Tech Stack

**Backend:** FastAPI (Python)
**Frontend:** React (Vite) + Tailwind CSS
**Database & Auth:** Supabase (PostgreSQL, Auth, Storage)
**AI:** Groq (LLaMA models) — planned for resume parsing/ranking

## 📁 Project Structure

```
ai-hr-saas/
├── backend/
│   ├── main.py              # FastAPI app entrypoint, router registration
│   ├── routers/
│   │   ├── auth.py          # signup, login, get current user
│   │   ├── jobs.py          # job CRUD + public job listing
│   │   └── candidates.py    # public apply endpoint, candidate listing, status updates
│   ├── requirements.txt
│   └── .env                 # not committed — see setup below
├── frontend/
│   └── (React + Vite + Tailwind, in progress)
└── README.md
```

## 🔒 Security Model

- Every protected route requires a valid Supabase JWT (`Authorization: Bearer <token>`).
- Multi-tenant isolation is enforced at the application layer: each request resolves the caller's company, and every job/candidate lookup is checked against that company before returning or mutating data.
- Resume uploads are validated for file type (PDF only, verified by content, not just extension) and size before being stored.

## ⚙️ Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- A Supabase project (free tier works)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

Run the server:

```bash
uvicorn main:app --reload
```

API docs available at `http://127.0.0.1:8000/docs`.

### Database Schema

Run the SQL in `docs/schema.sql` (or see commit history) against your Supabase project. It sets up `companies`, `jobs`, and `candidates` tables with Row Level Security enabled.

You'll also need a public Storage bucket named `resumes` for resume uploads.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 📍 Roadmap

See [project status](#-project-status) above. Full phased roadmap (AI layer, onboarding automation, SaaS multi-tenancy, scale features) is being built out incrementally and documented as it ships.

## 📄 License

Not yet decided — private/portfolio project for now.