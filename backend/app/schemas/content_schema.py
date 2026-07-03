# app/schemas/content_schema.py
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


# --- DECK SCHEMAS ---
class DeckCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    is_public: bool = False


class DeckResponse(BaseModel):
    deck_id: UUID
    title: str
    description: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    created_at: datetime
    is_default: int
    card_count: int = 0
    is_public: bool = False
    fork_count: int = 0
    like_count: int = 0
    original_deck_id: UUID | None = None
    has_changes: bool = False
    due_count: int = 0
    pending_pr_count: int = 0

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


# --- PULL REQUEST SCHEMAS ---
class PullRequestCreate(BaseModel):
    message: str | None = None

class PullRequestResponse(BaseModel):
    pr_id: UUID
    original_deck_id: UUID
    forked_deck_id: UUID
    author_id: UUID
    author_username: str | None = None
    status: str
    message: str | None = None
    created_at: datetime
    new_cards_count: int = 0
    new_cards: list[CardResponse] | None = None

    class Config:
        from_attributes = True

class PullRequestApproveRequest(BaseModel):
    card_ids: list[UUID] | None = None
