from app.api import auth_router, deck_router, study_router, social_router

# app/main.py (Snippet to add)
from app.db.database import engine, get_db
from app.models import all_models
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

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
        columns_to_add = [
            "ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE users ADD COLUMN username VARCHAR(50);",
            "ALTER TABLE users ADD COLUMN full_name VARCHAR(100);",
            "ALTER TABLE users ADD COLUMN bio TEXT;",
            "ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR(255);"
        ]
        
        for query in columns_to_add:
            try:
                connection.execute(text(query))
                connection.commit()
                print(f"Successfully executed: {query}")
            except Exception as e:
                # Normal if column already exists
                pass


app.include_router(auth_router.router)
app.include_router(deck_router.router)
app.include_router(study_router.router)
app.include_router(social_router.router)


@app.get("/")
def read_root():
    return {"status": "online", "message": "Welcome to the Mini Anki API war room."}


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception:
        db_status = "unreachable"
    return {"db_status": db_status, "api_status": "healthy"}
