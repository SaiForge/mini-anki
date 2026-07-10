import os
import logging

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
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pathlib import Path
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.redis import init_redis, close_redis

# SECURITY FIX (Critical #4): Rate limiting
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter

logger = logging.getLogger(__name__)

# This creates the tables in PostgreSQL if they don't exist yet
all_models.Base.metadata.create_all(bind=engine)

# ─────────────────────────────────────────────────────────────────────────────
# SECURITY FIX (Medium #11): Disable Swagger/OpenAPI docs in production.
#
# WHY: The interactive API docs at /docs expose every endpoint, schema, and
# a "Try it out" button — effectively handing attackers a ready-made attack
# surface. Set ENVIRONMENT=production in your Azure App Service config.
# ─────────────────────────────────────────────────────────────────────────────
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"

app = FastAPI(
    title="Study Lab API",
    description="Multi-user spaced repetition flashcard backend.",
    version="1.0.0",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

# Attach the rate limiter to app state so slowapi can find it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ─────────────────────────────────────────────────────────────────────────────
# SECURITY FIX (High #5): Global exception handler.
#
# WHY: Unhandled Python exceptions can bubble up as 500 responses that include
# stack traces, file paths, DB schema, or library internals — intelligence
# that attackers use for reconnaissance. This handler logs the full detail
# internally while returning a generic message to the client.
# ─────────────────────────────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url.path,
        exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again later."},
    )

# ─────────────────────────────────────────────────────────────────────────────
# CORS Configuration
#
# SECURITY FIX (High #6): Replaced allow_methods=["*"] and allow_headers=["*"]
#   with explicit allowlists. The wildcard enabled TRACE (Cross-Site Tracing)
#   and allowed arbitrary custom headers.
#
# SECURITY FIX (High #7): Removed hardcoded public EC2 IP (18.118.210.98).
#   A static IP is a fragile, untestable trust anchor. Use EXTRA_CORS_ORIGIN
#   env var instead so it's configurable per environment.
# ─────────────────────────────────────────────────────────────────────────────
_frontend_url = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
_azure_url = os.getenv("AZURE_STATIC_WEB_APP_URL", "")
_extra_origin = os.getenv("EXTRA_CORS_ORIGIN", "")  # replaces hardcoded EC2 IP

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5174",
    _frontend_url,
]

if _azure_url:
    origins.append(_azure_url.rstrip("/"))
if _extra_origin:
    origins.append(_extra_origin.rstrip("/"))

# Deduplicate and remove empty strings
origins = list(dict.fromkeys(o for o in origins if o))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # Local dev: allow any localhost port (still HTTP-only, safe for dev)
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    # Explicit methods only — no TRACE, no CONNECT
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    # Explicit headers only
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
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
        "ALTER TABLE decks ADD COLUMN comment_count INTEGER DEFAULT 0;",
        "ALTER TABLE decks ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"
    ]

    for query in columns_to_add:
        try:
            with engine.begin() as connection:
                connection.execute(text(query))
            print(f"Successfully executed: {query}")
        except Exception:
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
