from app.api import auth_router, deck_router, study_router

# app/main.py (Snippet to add)
from app.db.database import engine
from app.models import all_models
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

# This creates the tables in PostgreSQL if they don't exist yet
all_models.Base.metadata.create_all(bind=engine)

CORSMiddleware

# Initialize the application
app = FastAPI(
    title="Mini Anki API",
    description="Multi-user spaced repetition flashcard backend.",
    version="1.0.0",
)

# CORS Configuration (Crucial so our React frontend can talk to it)
origins = [
    "http://localhost:5173",  # Your local Vite frontend
    "http://localhost:3000",  # Just in case you use React standard port
    "https://minianki.netlify.app",  # Your LIVE Production Frontend
]

# Attach the security bypass
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # This locks down the API to only the list above
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def migrate_database_schema():
    print("Running database schema check...")
    with engine.connect() as connection:
        try:
            connection.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;"))
            connection.commit()
            print("Successfully added 'is_verified' column to users table!")
        except Exception as e:
            print(f"Schema update notice (Normal if column exists): {e}")


app.include_router(auth_router.router)
app.include_router(deck_router.router)
app.include_router(study_router.router)


@app.get("/")
def read_root():
    return {"status": "online", "message": "Welcome to the Mini Anki API war room."}


@app.get("/health")
def health_check():
    return {"db_status": "pending", "api_status": "healthy"}
