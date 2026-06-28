# app/api/deck_router.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid
from datetime import datetime, timezone
from app.db.database import get_db
from app.models.all_models import Deck, Card, Schedule, User
from app.schemas.content_schema import (
    DeckCreate,
    DeckResponse,
    CardCreate,
    CardResponse,
)
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/decks", tags=["Decks & Cards"])


@router.post("/", response_model=DeckResponse, status_code=status.HTTP_201_CREATED)
def create_deck(
    deck: DeckCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Create the deck and strictly bind it to the authenticated user
    new_deck = Deck(
        title=deck.title,
        description=deck.description,
        category=deck.category,
        tags=deck.tags,
        is_public=deck.is_public,
        user_id=current_user.user_id,
    )
    db.add(new_deck)
    db.commit()
    db.refresh(new_deck)
    # Attach card_count for the response schema
    new_deck.card_count = 0
    return new_deck


@router.get("/", response_model=list[DeckResponse])
def get_user_decks(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    # Ensure user has a default deck (for migration purposes)
    existing_default = (
        db.query(Deck)
        .filter(Deck.user_id == current_user.user_id, Deck.is_default == 1)
        .first()
    )
    if not existing_default:
        default_deck = Deck(
            title="📚 Today's Review", user_id=current_user.user_id, is_default=1
        )
        db.add(default_deck)
        db.commit()

    # Only return decks belonging to this specific user (Tenant Isolation)
    decks = db.query(Deck).filter(Deck.user_id == current_user.user_id).all()
    # Annotate each deck with its real card count + sharing fields
    today = datetime.now(timezone.utc).date()
    for deck in decks:
        if deck.is_default:
            user_deck_ids = [d.deck_id for d in decks]
            due_cards_count = (
                db.query(Card)
                .join(Schedule)
                .filter(Card.deck_id.in_(user_deck_ids), Schedule.next_review_date <= today)
                .count()
            )
            deck.card_count = due_cards_count
        else:
            deck.card_count = len(deck.cards)
        
        deck.has_changes = False
        if deck.original_deck_id:
            original_deck = db.query(Deck).filter(Deck.deck_id == deck.original_deck_id).first()
            if original_deck:
                orig_cards = {(c.front_text, c.back_text) for c in original_deck.cards}
                fork_cards = {(c.front_text, c.back_text) for c in deck.cards}
                # Check if fork has cards that are not in original
                new_cards = fork_cards - orig_cards
                if new_cards:
                    deck.has_changes = True

    return decks


@router.get("/user/{user_id}/public", response_model=list[DeckResponse])
def get_user_public_decks(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    # Only return public decks belonging to this specific user
    decks = db.query(Deck).filter(Deck.user_id == user_id, Deck.is_public == True).all()
    # Annotate each deck with its real card count
    for deck in decks:
        deck.card_count = len(deck.cards)
        deck.has_changes = False

    return decks


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(
    deck_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify deck exists and belongs to current user before deletion.
    deck = (
        db.query(Deck)
        .filter(Deck.deck_id == deck_id, Deck.user_id == current_user.user_id)
        .first()
    )
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found or access denied")

    # Prevent deletion of default deck
    if deck.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default deck")

    db.delete(deck)
    db.commit()
    return None


@router.post(
    "/{deck_id}/cards", response_model=CardResponse, status_code=status.HTTP_201_CREATED
)
def create_card(
    deck_id: uuid.UUID,
    card: CardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. IDOR Protection: Verify the deck exists AND belongs to the user
    deck = (
        db.query(Deck)
        .filter(Deck.deck_id == deck_id, Deck.user_id == current_user.user_id)
        .first()
    )
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found or access denied")

    # 1.5 Prevent adding cards to default deck
    if deck.is_default:
        raise HTTPException(
            status_code=400, detail="Cannot add cards to the default deck"
        )

    # 2. Create the Flashcard (Content DB)
    new_card = Card(
        deck_id=deck.deck_id, front_text=card.front_text, back_text=card.back_text
    )
    db.add(new_card)
    db.flush()  # Flushes to DB to generate the card_id, but doesn't commit transaction yet

    # 3. Initialize the Spaced Repetition Schedule (Schedule DB)
    # Default: Due today, 0 interval days
    new_schedule = Schedule(
        card_id=new_card.card_id, next_review_date=datetime.now(timezone.utc).date()
    )
    db.add(new_schedule)

    # 4. Automatically add to forked decks
    forked_decks = db.query(Deck).filter(Deck.original_deck_id == deck.deck_id).all()
    for forked_deck in forked_decks:
        fork_card = Card(
            deck_id=forked_deck.deck_id,
            front_text=card.front_text,
            back_text=card.back_text,
        )
        db.add(fork_card)
        db.flush()
        fork_sched = Schedule(
            card_id=fork_card.card_id,
            next_review_date=datetime.now(timezone.utc).date()
        )
        db.add(fork_sched)

    db.commit()
    db.refresh(new_card)
    return new_card


@router.post("/{deck_id}/publish", status_code=status.HTTP_200_OK)
def publish_deck(
    deck_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deck = db.query(Deck).filter(Deck.deck_id == deck_id, Deck.user_id == current_user.user_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    deck.is_public = True
    db.commit()
    return {"message": "Deck published"}


@router.post("/{deck_id}/unpublish", status_code=status.HTTP_200_OK)
def unpublish_deck(
    deck_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deck = db.query(Deck).filter(Deck.deck_id == deck_id, Deck.user_id == current_user.user_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    deck.is_public = False
    db.commit()
    return {"message": "Deck unpublished"}


@router.delete("/{deck_id}/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_card(
    deck_id: uuid.UUID,
    card_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deck = db.query(Deck).filter(Deck.deck_id == deck_id, Deck.user_id == current_user.user_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found or access denied")
    
    card = db.query(Card).filter(Card.card_id == card_id, Card.deck_id == deck_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
        
    db.delete(card)
    db.commit()
    return None

@router.get(
    "/{deck_id}/cards", response_model=list[CardResponse]
)
def get_deck_cards(
    deck_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deck = (
        db.query(Deck)
        .filter(Deck.deck_id == deck_id, Deck.user_id == current_user.user_id)
        .first()
    )
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found or access denied")
    return deck.cards
