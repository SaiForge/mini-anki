# app/schemas/study_schema.py
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import date

# What React sends when a user clicks a grade button
class GradeSubmission(BaseModel):
    card_id: UUID
    grade: str = Field(..., pattern="^(Again|Hard|Good|Easy)$")

# What React receives when asking for the study queue
class DueCardResponse(BaseModel):
    card_id: UUID
    front_text: str
    back_text: str
    current_interval_days: int

    class Config:
        from_attributes = True

# Response after successfully grading a card
class GradeResponse(BaseModel):
    success: bool
    next_review_date: date
    new_interval_days: int
