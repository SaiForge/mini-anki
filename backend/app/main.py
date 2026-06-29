from app.api import auth_router, deck_router, study_router, social_router, feed_router
from app.api.explore_router import explore_router, deck_share_router
from app.api.notification_router import router as notification_router
from app.api.analytics_router import router as analytics_router
from app.api.upload_router import router as upload_router
from app.api.dm_router import router as dm_router
from app.api.ai_router import router as ai_router

# app/main.py
from app.db.database import engine, get_db
from app.models import all_models
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.redis import init_redis, close_redis

# This creates the tables in PostgreSQL if they don't exist yet
all_models.Base.metadata.create_all(bind=engine)

CORSMiddleware

# Initialize the application
app = FastAPI(
    title="Mini Anki API",
    description="Multi-user spaced repetition flashcard backend.",
    version="1.0.0",
)

import os

# CORS Configuration — read from env so it works in both local dev and production
_frontend_url = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
_vite_url = os.getenv("VITE_API_URL", "")  # sometimes frontend sends this

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5174",
    _frontend_url,
]
# Also allow the deployed EC2 frontend (port 5173)
_ec2_ip = "18.118.210.98"
origins += [f"http://{_ec2_ip}:5173", f"http://{_ec2_ip}", f"https://{_ec2_ip}"]
# Deduplicate
origins = list(dict.fromkeys(o for o in origins if o))

# Attach the security middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):\d+",  # any local port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.on_event("startup")
async def startup_event():
    await init_redis()

@app.on_event("shutdown")
async def shutdown_event():
    await close_redis()

@app.on_event("startup")
def migrate_database_schema():
    print("Running database schema check...")
    columns_to_add = [
        "ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE users ADD COLUMN username VARCHAR(50);",
        "ALTER TABLE users ADD COLUMN full_name VARCHAR(100);",
        "ALTER TABLE users ADD COLUMN bio TEXT;",
        "ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR(255);",
        "ALTER TABLE decks ADD COLUMN comment_count INTEGER DEFAULT 0;",
        "ALTER TABLE decks ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"
    ]
    
    for query in columns_to_add:
        try:
            with engine.begin() as connection:
                connection.execute(text(query))
            print(f"Successfully executed: {query}")
        except Exception as e:
            # Normal if column already exists
            pass


app.include_router(auth_router.router)
app.include_router(deck_router.router)
app.include_router(deck_share_router)   # Phase 3 deck sharing
app.include_router(study_router.router)
app.include_router(social_router.router)
app.include_router(feed_router.router)
app.include_router(explore_router)      # Phase 3 discovery
app.include_router(notification_router) # Phase 4 notifications
app.include_router(analytics_router)    # Phase 4 analytics
app.include_router(upload_router)       # Phase 5 file uploads
app.include_router(dm_router)           # Phase 5 direct messaging
app.include_router(ai_router)           # Phase 5 AI companion

# Serve uploaded files as static assets
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


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
