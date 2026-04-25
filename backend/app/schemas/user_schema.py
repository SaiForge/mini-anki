# app/schemas/user_schema.py
from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime

# What we expect from the user when they register/login
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)

# What we send back to the user (Notice we DO NOT send the password_hash!)
class UserResponse(BaseModel):
    user_id: UUID
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True

# What we send back upon successful login
class Token(BaseModel):
    access_token: str
    token_type: str
