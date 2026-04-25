# app/schemas/content_schema.py
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime

# --- DECK SCHEMAS ---
class DeckCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)

class DeckResponse(BaseModel):
    deck_id: UUID
    title: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- CARD SCHEMAS ---
class CardCreate(BaseModel):
    front_text: str = Field(..., min_length=1)
    back_text: str = Field(..., min_length=1)

class CardResponse(BaseModel):
    card_id: UUID
    deck_id: UUID
    front_text: str
    back_text: str
    created_at: datetime

    class Config:
        from_attributes = True
