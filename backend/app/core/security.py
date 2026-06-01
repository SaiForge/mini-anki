# app/core/security.py
import os
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt
from passlib.context import CryptContext

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-jwt-key-change-me-later")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days for our MVP
EMAIL_VERIFICATION_SECRET = os.getenv("EMAIL_VERIFICATION_SECRET", SECRET_KEY)
EMAIL_VERIFICATION_EXPIRE_HOURS = int(os.getenv("EMAIL_VERIFICATION_EXPIRE_HOURS", "24"))

# Bcrypt setup for password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_email_verification_token(email: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=EMAIL_VERIFICATION_EXPIRE_HOURS)
    to_encode = {"sub": email, "exp": expire, "type": "email_verify"}
    return jwt.encode(to_encode, EMAIL_VERIFICATION_SECRET, algorithm=ALGORITHM)


def decode_email_verification_token(token: str) -> str:
    payload = jwt.decode(token, EMAIL_VERIFICATION_SECRET, algorithms=[ALGORITHM])
    if payload.get("type") != "email_verify":
        raise ValueError("Invalid token type")
    email = payload.get("sub")
    if not email:
        raise ValueError("Token missing subject")
    return email
