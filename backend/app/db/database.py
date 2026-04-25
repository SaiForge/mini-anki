# app/db/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Load DB URL from environment (we will use a simple fallback for now)
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/minianki")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get the DB session in our API endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
