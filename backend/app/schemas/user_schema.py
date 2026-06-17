# app/schemas/user_schema.py
from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime, date
from typing import Optional


# What we expect from the user when they register/login
class UserCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8, max_length=72)
    bio: Optional[str] = None
    profile_picture_url: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    bio: Optional[str] = None
    profile_picture_url: Optional[str] = None



class UserEmailRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=72)


# What we send back to the user (Notice we DO NOT send the password_hash!)
class UserResponse(BaseModel):
    user_id: UUID
    email: EmailStr
    username: Optional[str] = None
    full_name: Optional[str] = None
    bio: Optional[str] = None
    profile_picture_url: Optional[str] = None
    created_at: datetime
    is_verified: bool
    current_streak: int
    last_review_date: Optional[date]

    class Config:
        from_attributes = True


# What we send back upon successful login
class Token(BaseModel):
    access_token: str
    token_type: str


class MessageResponse(BaseModel):
    message: str
