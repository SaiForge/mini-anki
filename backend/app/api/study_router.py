# app/api/study_router.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.db.database import get_db
from app.models.all_models import Card, Schedule, ReviewLog, Deck, User
from app.schemas.study_schema import GradeSubmission, DueCardResponse, GradeResponse
from app.api.deps import get_current_user
from app.services.srs_engine import calculate_next_review

router = APIRouter(prefix="/api/study", tags=["Study Engine"])

@router.get("/{deck_id}/due", response_model=list[DueCardResponse])
def get_due_cards(deck_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. Verify deck ownership
    deck = db.query(Deck).filter(Deck.deck_id == deck_id, Deck.user_id == current_user.user_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    # 2. Query for due cards using a JOIN between Cards and Schedules
    today = datetime.now(timezone.utc).date()
    due_cards = db.query(Card, Schedule).join(Schedule).filter(
        Card.deck_id == deck_id,
        Schedule.next_review_date <= today
    ).all()

    # 3. Format the response
    response_data = []
    for card, schedule in due_cards:
        response_data.append({
            "card_id": card.card_id,
            "front_text": card.front_text,
            "back_text": card.back_text,
            "current_interval_days": schedule.current_interval_days
        })

    return response_data

@router.post("/grade", response_model=GradeResponse)
def submit_card_grade(submission: GradeSubmission, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. Find the card and its schedule. Ensure it belongs to the user.
    card_data = db.query(Card, Schedule).join(Schedule).join(Deck).filter(
        Card.card_id == submission.card_id,
        Deck.user_id == current_user.user_id # Strict tenant isolation
    ).first()

    if not card_data:
        raise HTTPException(status_code=404, detail="Card not found or access denied")

    card, schedule = card_data

    # 2. Calculate the new spaced repetition interval
    new_interval, next_date = calculate_next_review(
        grade=submission.grade,
        current_interval=schedule.current_interval_days
    )

    # 3. Update the Schedule DB
    schedule.current_interval_days = new_interval
    schedule.next_review_date = next_date

    # 4. Append to the Analytics DB (ReviewLog)
    review_log = ReviewLog(
        card_id=card.card_id,
        grade_submitted=submission.grade
    )
    db.add(review_log)

    # 5. Commit the transaction
    db.commit()

    return {
        "success": True,
        "next_review_date": next_date,
        "new_interval_days": new_interval
    }
