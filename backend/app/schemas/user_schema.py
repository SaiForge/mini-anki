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
    gender: Optional[str] = None
    dob: Optional[date] = None
    role: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    bio: Optional[str] = None
    website_url: Optional[str] = None
    location: Optional[str] = None
    is_public: Optional[bool] = None
    tags: Optional[list[str]] = None
    gender: Optional[str] = None
    dob: Optional[date] = None
    role: Optional[str] = None



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
    website_url: Optional[str] = None
    location: Optional[str] = None
    is_public: Optional[bool] = None
    tags: Optional[list[str]] = None
    gender: Optional[str] = None
    dob: Optional[date] = None
    role: Optional[str] = None
    created_at: datetime
    is_verified: bool
    current_streak: int
    last_review_date: Optional[date]
    followers_count: Optional[int] = 0
    following_count: Optional[int] = 0

    class Config:
        from_attributes = True


class PublicUserResponse(BaseModel):
    user_id: UUID
    username: Optional[str] = None
    full_name: Optional[str] = None
    bio: Optional[str] = None
    website_url: Optional[str] = None
    location: Optional[str] = None
    tags: Optional[list[str]] = None
    gender: Optional[str] = None
    role: Optional[str] = None
    current_streak: int
    followers_count: int
    following_count: int

    class Config:
        from_attributes = True


# What we send back upon successful login
class Token(BaseModel):
    access_token: str
    token_type: str
    is_new_user: Optional[bool] = False


class MessageResponse(BaseModel):
    message: str
