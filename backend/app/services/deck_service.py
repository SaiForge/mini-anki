from sqlalchemy.orm import Session
from app.models.all_models import Deck, Card, Post, Schedule
from datetime import datetime, timezone
import uuid

class DeckService:
    @staticmethod
    def save_post_to_deck(db: Session, deck_id: uuid.UUID, post_id: uuid.UUID, user_id: uuid.UUID) -> Card:
        deck = db.query(Deck).filter(Deck.deck_id == deck_id, Deck.user_id == user_id).first()
        if not deck:
            raise ValueError("Deck not found or access denied")
            
        if deck.is_default:
            raise ValueError("Cannot save to default deck")
            
        post = db.query(Post).filter(Post.post_id == post_id).first()
        if not post:
            raise ValueError("Post not found")
            
        if post.is_private and post.author_id != user_id:
            raise ValueError("Post is private")
            
        front = post.title if post.title else "Post snippet"
        back = post.body
        
        new_card = Card(
            deck_id=deck.deck_id,
            front_text=front,
            back_text=back
        )
        db.add(new_card)
        db.flush()
        
        new_schedule = Schedule(
            card_id=new_card.card_id,
            next_review_date=datetime.now(timezone.utc).date()
        )
        db.add(new_schedule)
        db.commit()
        db.refresh(new_card)
        
        return new_card
