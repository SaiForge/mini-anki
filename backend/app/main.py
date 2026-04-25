from fastapi import FastAPI
from app.api import auth_router, deck_router, study_router
from fastapi.middleware.cors import CORSMiddleware
# app/main.py (Snippet to add)
from app.db.database import engine
from app.models import all_models

# This creates the tables in PostgreSQL if they don't exist yet
all_models.Base.metadata.create_all(bind=engine)

CORSMiddleware

# Initialize the application
app = FastAPI(
    title="Mini Anki API",
    description="Multi-user spaced repetition flashcard backend.",
    version="1.0.0"
)

# CORS Configuration (Crucial so our React frontend can talk to it)
origins = [
    "http://localhost:5173", # Standard Vite/React port
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows GET, POST, PUT, DELETE
    allow_headers=["*"], # Allows Authorization headers (JWT)
)

app.include_router(auth_router.router)
app.include_router(deck_router.router)
app.include_router(study_router.router)

@app.get("/")
def read_root():
    return {"status": "online", "message": "Welcome to the Mini Anki API war room."}

@app.get("/health")
def health_check():
    return {"db_status": "pending", "api_status": "healthy"}
