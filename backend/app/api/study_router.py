# app/api/study_router.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid
from datetime import datetime, timezone, timedelta, date
from app.db.database import get_db
from app.models.all_models import Card, Schedule, ReviewLog, Deck, User
from app.schemas.study_schema import GradeSubmission, DueCardResponse, GradeResponse
from app.api.deps import get_current_user
from app.services.srs_engine import calculate_next_review

router = APIRouter(prefix="/api/study", tags=["Study Engine"])


def _update_user_streak(user: User, db: Session) -> bool:
    """
    Update user streak if they've reviewed the default deck today.
    Returns True if streak was updated, False otherwise.
    """
    today = datetime.now(timezone.utc).date()

    # If already reviewed today, don't update again
    if user.last_review_date == today:
        return False

    # Update streak based on previous review date
    if user.last_review_date == today - timedelta(days=1):
        # Reviewed yesterday, increment streak
        user.current_streak += 1
    else:
        # Missed a day or first review, reset to 1
        user.current_streak = 1

    user.last_review_date = today
    db.add(user)
    return True


@router.get("/{deck_id}/due", response_model=list[DueCardResponse])
def get_due_cards(
    deck_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Verify deck ownership and check if it's the default deck
    deck = (
        db.query(Deck)
        .filter(Deck.deck_id == deck_id, Deck.user_id == current_user.user_id)
        .first()
    )
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    # 2. Query for due cards using a JOIN between Cards and Schedules
    today = datetime.now(timezone.utc).date()

    if deck.is_default:
        # For default deck, fetch all due cards from all user's decks
        user_deck_ids = (
            db.query(Deck.deck_id).filter(Deck.user_id == current_user.user_id).all()
        )
        user_deck_ids = [d[0] for d in user_deck_ids]

        due_cards = (
            db.query(Card, Schedule)
            .join(Schedule)
            .filter(Card.deck_id.in_(user_deck_ids), Schedule.next_review_date <= today)
            .all()
        )
    else:
        # For regular decks, fetch only from this deck
        due_cards = (
            db.query(Card, Schedule)
            .join(Schedule)
            .filter(Card.deck_id == deck_id, Schedule.next_review_date <= today)
            .all()
        )

    # 3. Format the response
    response_data = []
    for card, schedule in due_cards:
        response_data.append(
            {
                "card_id": card.card_id,
                "front_text": card.front_text,
                "back_text": card.back_text,
                "current_interval_days": schedule.current_interval_days,
            }
        )

    return response_data


@router.post("/grade", response_model=GradeResponse)
def submit_card_grade(
    submission: GradeSubmission,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Find the card and its schedule. Ensure it belongs to the user.
    card_data = (
        db.query(Card, Schedule)
        .join(Schedule)
        .join(Deck)
        .filter(
            Card.card_id == submission.card_id,
            Deck.user_id == current_user.user_id,  # Strict tenant isolation
        )
        .first()
    )

    if not card_data:
        raise HTTPException(status_code=404, detail="Card not found or access denied")

    card, schedule = card_data

    # 2. Calculate the new spaced repetition interval
    new_interval, next_date = calculate_next_review(
        grade=submission.grade, current_interval=schedule.current_interval_days
    )

    # 3. Update the Schedule DB
    schedule.current_interval_days = new_interval
    schedule.next_review_date = next_date

    # 4. Append to the Analytics DB (ReviewLog)
    review_log = ReviewLog(card_id=card.card_id, grade_submitted=submission.grade)
    db.add(review_log)

    # 5. Streak logic: Check if user has completed all due cards in default deck
    today = datetime.now(timezone.utc).date()

    # Check remaining due cards in default deck
    user_deck_ids = (
        db.query(Deck.deck_id).filter(Deck.user_id == current_user.user_id).all()
    )
    user_deck_ids = [d[0] for d in user_deck_ids]

    remaining_due_cards = (
        db.query(Card, Schedule)
        .join(Schedule)
        .filter(
            Card.deck_id.in_(user_deck_ids),
            Schedule.next_review_date <= today,
            Card.card_id
            != card.card_id,  # Exclude current card since we just reviewed it
        )
        .count()
    )

    # If no more due cards in default deck today, update streak
    if remaining_due_cards == 0:
        _update_user_streak(current_user, db)

    # 6. Commit the transaction
    db.commit()

    return {
        "success": True,
        "next_review_date": next_date,
        "new_interval_days": new_interval,
    }


class CheckInResponse(BaseModel):
    success: bool
    current_streak: int


@router.post("/{deck_id}/check-in", response_model=CheckInResponse)
def check_in_deck(
    deck_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Check in to the default deck. Only updates the streak if the user
    has zero due cards remaining (i.e., they have completed all reviews).
    """
    # 1. Verify deck ownership
    deck = (
        db.query(Deck)
        .filter(Deck.deck_id == deck_id, Deck.user_id == current_user.user_id)
        .first()
    )
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    # 2. Only allow check-in on default deck
    if not deck.is_default:
        raise HTTPException(
            status_code=400, detail="Check-in only available for default deck"
        )

    # 3. Only update streak if user has no due cards remaining
    today = datetime.now(timezone.utc).date()

    user_deck_ids = (
        db.query(Deck.deck_id).filter(Deck.user_id == current_user.user_id).all()
    )
    user_deck_ids = [d[0] for d in user_deck_ids]

    remaining_due_cards = (
        db.query(Card, Schedule)
        .join(Schedule)
        .filter(
            Card.deck_id.in_(user_deck_ids),
            Schedule.next_review_date <= today,
        )
        .count()
    )

    if remaining_due_cards == 0:
        _update_user_streak(current_user, db)

    # 4. Commit
    db.commit()

    return {
        "success": True,
        "current_streak": current_user.current_streak,
    }
