# app/api/analytics_router.py
"""
Phase 4: Analytics API
Endpoints:
  GET /api/analytics/study-stats      - aggregated stats for current user
  GET /api/analytics/review-history   - last 30 days of review data
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta, timezone

from app.db.database import get_db
from app.models.all_models import User, Schedule, Deck, Card, Post, PostLike
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/study-stats")
def get_study_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return aggregated study stats for the current user."""
    # Count cards due / reviewed
    total_cards = (
        db.query(func.count(Card.card_id))
        .join(Deck, Deck.deck_id == Card.deck_id)
        .filter(Deck.user_id == current_user.user_id)
        .scalar() or 0
    )

    # Cards reviewed today (next_review_date <= today in Schedule)
    today = datetime.now(timezone.utc).date()
    cards_due_today = (
        db.query(func.count(Schedule.schedule_id))
        .join(Card, Card.card_id == Schedule.card_id)
        .join(Deck, Deck.deck_id == Card.deck_id)
        .filter(
            Deck.user_id == current_user.user_id,
            Schedule.next_review_date <= today,
        )
        .scalar() or 0
    )

    # Total decks
    total_decks = (
        db.query(func.count(Deck.deck_id))
        .filter(Deck.user_id == current_user.user_id)
        .scalar() or 0
    )

    # Posts authored
    total_posts = (
        db.query(func.count(Post.post_id))
        .filter(Post.author_id == current_user.user_id)
        .scalar() or 0
    )

    # Total likes received on own posts
    likes_received = (
        db.query(func.count(PostLike.like_id))
        .join(Post, Post.post_id == PostLike.post_id)
        .filter(Post.author_id == current_user.user_id)
        .scalar() or 0
    )

    # Streak (from User model)
    streak = getattr(current_user, "streak_count", 0) or 0

    return {
        "total_cards": total_cards,
        "cards_due_today": cards_due_today,
        "total_decks": total_decks,
        "total_posts": total_posts,
        "likes_received": likes_received,
        "daily_streak": streak,
    }


@router.get("/review-history")
def get_review_history(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return per-day card counts for the last `days` days.
    We approximate from Schedule.last_reviewed (if available) or next_review_date.
    """
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)

    # Build a list of all days in range
    day_list = [(start + timedelta(days=i)).isoformat() for i in range(days)]

    # Query schedules that have been reviewed in the window
    try:
        rows = (
            db.query(
                func.date(Schedule.next_review_date).label("day"),
                func.count(Schedule.schedule_id).label("count"),
            )
            .join(Card, Card.card_id == Schedule.card_id)
            .join(Deck, Deck.deck_id == Card.deck_id)
            .filter(
                Deck.user_id == current_user.user_id,
                Schedule.next_review_date >= start,
                Schedule.next_review_date <= today,
            )
            .group_by(func.date(Schedule.next_review_date))
            .all()
        )
        day_counts = {str(r.day): r.count for r in rows}
    except Exception:
        day_counts = {}

    return [
        {"date": d, "count": day_counts.get(d, 0)}
        for d in day_list
    ]
