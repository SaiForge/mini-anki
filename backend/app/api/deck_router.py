# app/api/deck_router.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.db.database import get_db
from app.models.all_models import Deck, Card, Schedule, User
from app.schemas.content_schema import DeckCreate, DeckResponse, CardCreate, CardResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/decks", tags=["Decks & Cards"])

@router.post("/", response_model=DeckResponse, status_code=status.HTTP_201_CREATED)
def create_deck(deck: DeckCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Create the deck and strictly bind it to the authenticated user
    new_deck = Deck(title=deck.title, user_id=current_user.user_id)
    db.add(new_deck)
    db.commit()
    db.refresh(new_deck)
    return new_deck

@router.get("/", response_model=list[DeckResponse])
def get_user_decks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Only return decks belonging to this specific user (Tenant Isolation)
    decks = db.query(Deck).filter(Deck.user_id == current_user.user_id).all()
    return decks

@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(deck_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify deck exists and belongs to current user before deletion.
    deck = db.query(Deck).filter(Deck.deck_id == deck_id, Deck.user_id == current_user.user_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found or access denied")

    db.delete(deck)
    db.commit()
    return None

@router.post("/{deck_id}/cards", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
def create_card(deck_id: str, card: CardCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. IDOR Protection: Verify the deck exists AND belongs to the user
    deck = db.query(Deck).filter(Deck.deck_id == deck_id, Deck.user_id == current_user.user_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found or access denied")

    # 2. Create the Flashcard (Content DB)
    new_card = Card(deck_id=deck.deck_id, front_text=card.front_text, back_text=card.back_text)
    db.add(new_card)
    db.flush() # Flushes to DB to generate the card_id, but doesn't commit transaction yet

    # 3. Initialize the Spaced Repetition Schedule (Schedule DB)
    # Default: Due today, 0 interval days
    new_schedule = Schedule(card_id=new_card.card_id, next_review_date=datetime.now(timezone.utc).date())
    db.add(new_schedule)

    db.commit()
    db.refresh(new_card)
    return new_card
