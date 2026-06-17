# app/db/database.py
import os
import time
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger(__name__)

# DATABASE_URL is injected by docker-compose for Postgres.
# Falls back to SQLite only for bare local dev without Docker.
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./minianki.db"
)

# Build engine — SQLite needs check_same_thread=False; Postgres does not
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    # For Postgres: add a connection pool with retry logic
    # The db container may take 1-2 seconds after the health check passes
    _retries = 10
    for attempt in range(1, _retries + 1):
        try:
            engine = create_engine(
                SQLALCHEMY_DATABASE_URL,
                pool_pre_ping=True,       # test connections before handing them out
                pool_size=5,
                max_overflow=10,
            )
            # Eagerly verify the connection works
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info(f"✅ Connected to PostgreSQL (attempt {attempt})")
            break
        except Exception as exc:
            if attempt == _retries:
                raise RuntimeError(
                    f"Could not connect to the database after {_retries} attempts: {exc}"
                )
            wait = attempt * 2
            logger.warning(
                f"⏳ DB not ready (attempt {attempt}/{_retries}), retrying in {wait}s… ({exc})"
            )
            time.sleep(wait)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get the DB session in our API endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
