# app/api/explore_router.py
"""
Phase 3: Deck Sharing & Discovery API
Endpoints:
  GET  /api/explore/decks            - browse public decks (filterable, paginated)
  GET  /api/explore/decks/trending   - top decks by like_count + fork_count
  GET  /api/explore/search           - full-text search across decks + posts
  POST /api/decks/{deck_id}/publish  - make a deck public
  POST /api/decks/{deck_id}/unpublish- make a deck private
  POST /api/decks/{deck_id}/fork     - clone a public deck into the caller's library
  POST /api/decks/{deck_id}/like     - like a public deck
  DELETE /api/decks/{deck_id}/like   - unlike a public deck
  PUT  /api/decks/{deck_id}          - update deck metadata (title, desc, category)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, text, cast, String
import uuid
from datetime import datetime

from app.db.database import get_db
from app.models.all_models import Deck, DeckLike, Card, Schedule, Post, User, PullRequest
from app.api.deps import get_current_user
from app.schemas.content_schema import DeckResponse, CardResponse, PullRequestCreate, PullRequestResponse, PullRequestApproveRequest
from app.api.notification_router import create_notification

# ─── Routers ──────────────────────────────────────────────────────────────────
explore_router = APIRouter(prefix="/api/explore", tags=["Explore & Discovery"])
deck_share_router = APIRouter(prefix="/api/decks", tags=["Deck Sharing"])


# ─── Helper ───────────────────────────────────────────────────────────────────
def _annotate_deck(deck: Deck, user_id: uuid.UUID, db: Session) -> dict:
    """Return a plain dict representation of a Deck with extra fields."""
    is_liked = db.query(DeckLike).filter(
        DeckLike.deck_id == deck.deck_id,
        DeckLike.user_id == user_id
    ).first() is not None

    return {
        "deck_id": str(deck.deck_id),
        "title": deck.title,
        "description": deck.description,
        "category": deck.category,
        "tags": deck.tags,
        "is_public": deck.is_public,
        "is_default": deck.is_default,
        "fork_count": deck.fork_count or 0,
        "like_count": deck.like_count or 0,
        "comment_count": deck.comment_count or 0,
        "card_count": len(deck.cards),
        "original_deck_id": str(deck.original_deck_id) if deck.original_deck_id else None,
        "created_at": deck.created_at.isoformat() if deck.created_at else None,
        "is_liked": is_liked,
        "owner_username": deck.owner.username if deck.owner else None,
        "owner_id": str(deck.user_id) if deck.user_id else None,
        "owner_full_name": deck.owner.full_name if deck.owner else None,
        "owner_avatar_url": deck.owner.profile_picture_url if deck.owner else None,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# EXPLORE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@explore_router.get("/decks")
def browse_public_decks(
    category: str | None = Query(None, description="Filter by category"),
    q: str | None = Query(None, description="Search query"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Browse all public decks with optional category/search filter."""
    query = (
        db.query(Deck)
        .filter(Deck.is_public == True)
    )
    if category:
        query = query.filter(func.lower(Deck.category) == category.lower())
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            or_(
                func.lower(Deck.title).like(like),
                func.lower(Deck.description).like(like),
                func.lower(Deck.category).like(like),
            )
        )
    total = query.count()
    decks = query.order_by(Deck.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "total": total,
        "items": [_annotate_deck(d, current_user.user_id, db) for d in decks],
    }


@explore_router.get("/decks/trending")
def trending_decks(
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return top public decks by (like_count + fork_count) score."""
    decks = (
        db.query(Deck)
        .filter(Deck.is_public == True)
        .order_by((Deck.like_count + Deck.fork_count).desc(), Deck.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_annotate_deck(d, current_user.user_id, db) for d in decks]


@explore_router.get("/decks/{deck_id}")
def get_public_deck(
    deck_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return details of a single public deck."""
    deck = db.query(Deck).filter(Deck.deck_id == deck_id, Deck.is_public == True).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Public deck not found")
    return _annotate_deck(deck, current_user.user_id, db)


@explore_router.get("/decks/{deck_id}/cards", response_model=list[CardResponse])
def get_public_deck_cards(
    deck_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all cards in a public deck."""
    deck = db.query(Deck).filter(Deck.deck_id == deck_id, Deck.is_public == True).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Public deck not found")
    return deck.cards


@explore_router.get("/cards")
def browse_public_cards(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return individual cards from public decks, formatted for the feed."""
    from app.db.redis import get_cache_sync, set_cache_sync
    import json
    
    cache_key = f"explore:cards:{current_user.user_id}:{skip}:{limit}"
    cached = get_cache_sync(cache_key)
    if cached:
        return cached

    cards = (
        db.query(Card, Deck)
        .join(Deck, Card.deck_id == Deck.deck_id)
        .filter(Deck.is_public == True)
        .order_by(Card.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    result = []
    for card, deck in cards:
        # Determine if the user liked the deck
        is_liked = db.query(DeckLike).filter(
            DeckLike.deck_id == deck.deck_id,
            DeckLike.user_id == current_user.user_id
        ).first() is not None
        
        owner_name = deck.owner.full_name or deck.owner.username if deck.owner else "Anonymous"
        
        result.append({
            "id": str(card.card_id),
            "deckId": str(deck.deck_id),
            "category": deck.category or "FLASHCARD",
            "title": deck.title,
            "content": card.front_text,
            "codeSnippet": card.back_text,
            "likes": deck.like_count or 0,
            "likedByUser": is_liked,
            "timeLabel": deck.created_at.isoformat() if deck.created_at else None,
            "authorName": owner_name,
            "authorUsername": deck.owner.username if deck.owner else None,
            "authorId": str(deck.owner.user_id) if deck.owner else None,
            "authorAvatarUrl": deck.owner.profile_picture_url if deck.owner else None,
            "tags": deck.tags or [],
            "commentsCount": deck.comment_count or 0,
            "isDeckCard": True, # Custom flag for frontend
        })
        
    set_cache_sync(cache_key, result, expire_seconds=60)
    return {"items": result, "total": len(result)} # total here is just paginated count



@explore_router.get("/search")
def search(
    q: str = Query(..., min_length=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full-text search across public decks and public posts."""
    like = f"%{q.lower()}%"

    # Decks
    deck_results = (
        db.query(Deck)
        .filter(
            Deck.is_public == True,
            or_(
                func.lower(Deck.title).like(like),
                func.lower(Deck.description).like(like),
                func.lower(Deck.category).like(like),
                func.lower(cast(Deck.tags, String)).like(like)
            ),
        )
        .limit(limit)
        .all()
    )

    # Posts
    post_results = (
        db.query(Post)
        .filter(
            Post.is_private == False,
            or_(
                func.lower(Post.title).like(like),
                func.lower(Post.body).like(like),
                func.lower(Post.category).like(like),
            ),
        )
        .order_by(Post.created_at.desc())
        .limit(limit)
        .all()
    )

    # Users
    user_results = (
        db.query(User)
        .filter(
            User.user_id != current_user.user_id,
            or_(
                func.lower(User.username).like(like),
                func.lower(User.full_name).like(like),
            )
        )
        .limit(limit)
        .all()
    )

    return {
        "decks": [_annotate_deck(d, current_user.user_id, db) for d in deck_results],
        "users": [
            {
                "user_id": str(u.user_id),
                "username": u.username,
                "full_name": u.full_name,
                "bio": u.bio,
                "profile_picture_url": u.profile_picture_url,
                "current_streak": u.current_streak,
            }
            for u in user_results
        ],
        "posts": [
            {
                "post_id": str(p.post_id),
                "title": p.title,
                "body": p.body[:200],
                "category": p.category,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "author_username": p.author.username if p.author else None,
            }
            for p in post_results
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DECK SHARING ENDPOINTS  (mounted at /api/decks/...)
# ═══════════════════════════════════════════════════════════════════════════════

@deck_share_router.put("/{deck_id}")
def update_deck_metadata(
    deck_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update title, description, category of an owned deck."""
    deck = db.query(Deck).filter(
        Deck.deck_id == deck_id, Deck.user_id == current_user.user_id
    ).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    if "title" in payload and payload["title"]:
        deck.title = payload["title"]
    if "description" in payload:
        deck.description = payload["description"]
    if "category" in payload:
        deck.category = payload["category"]
    if "tags" in payload:
        deck.tags = payload["tags"]
    db.commit()
    db.refresh(deck)
    return _annotate_deck(deck, current_user.user_id, db)


@deck_share_router.post("/{deck_id}/publish", status_code=status.HTTP_200_OK)
def publish_deck(
    deck_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Make a deck publicly visible on the explore page."""
    deck = db.query(Deck).filter(
        Deck.deck_id == deck_id, Deck.user_id == current_user.user_id
    ).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    deck.is_public = True
    db.commit()
    return {"message": "Deck published", "is_public": True}


@deck_share_router.post("/{deck_id}/unpublish", status_code=status.HTTP_200_OK)
def unpublish_deck(
    deck_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Make a deck private (hide from explore)."""
    deck = db.query(Deck).filter(
        Deck.deck_id == deck_id, Deck.user_id == current_user.user_id
    ).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    deck.is_public = False
    db.commit()
    return {"message": "Deck unpublished", "is_public": False}


@deck_share_router.post("/{deck_id}/fork", status_code=status.HTTP_201_CREATED)
def fork_deck(
    deck_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clone a public deck (and all its cards) into the caller's library."""
    original = db.query(Deck).filter(
        Deck.deck_id == deck_id, Deck.is_public == True
    ).first()
    if not original:
        raise HTTPException(status_code=404, detail="Public deck not found")

    # Prevent forking own deck
    if original.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot fork your own deck")

    # Prevent double-fork
    already = db.query(Deck).filter(
        Deck.original_deck_id == deck_id,
        Deck.user_id == current_user.user_id,
    ).first()
    if already:
        return _annotate_deck(already, current_user.user_id, db)

    # Create the forked deck
    forked = Deck(
        title=f"{original.title} (Fork)",
        description=original.description,
        category=original.category,
        user_id=current_user.user_id,
        is_public=False,
        original_deck_id=original.deck_id,
    )
    db.add(forked)
    db.flush()

    # Clone all cards
    from datetime import timezone
    for card in original.cards:
        new_card = Card(
            deck_id=forked.deck_id,
            front_text=card.front_text,
            back_text=card.back_text,
        )
        db.add(new_card)
        db.flush()
        sched = Schedule(
            card_id=new_card.card_id,
            next_review_date=datetime.now(timezone.utc).date(),
        )
        db.add(sched)

    # Increment fork count on original
    original.fork_count = (original.fork_count or 0) + 1
    
    # Notify deck owner
    create_notification(
        db=db,
        recipient_id=original.user_id,
        actor_id=current_user.user_id,
        notif_type="DECK_FORK",
        message=f"@{current_user.username} forked your deck '{original.title}'",
        entity_type="DECK",
        entity_id=original.deck_id
    )
    
    db.commit()
    db.refresh(forked)
    return _annotate_deck(forked, current_user.user_id, db)


@deck_share_router.post("/{deck_id}/like", status_code=status.HTTP_200_OK)
def like_deck(
    deck_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deck = db.query(Deck).filter(Deck.deck_id == deck_id, Deck.is_public == True).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Public deck not found")

    exists = db.query(DeckLike).filter(
        DeckLike.deck_id == deck_id, DeckLike.user_id == current_user.user_id
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="Already liked")

    db.add(DeckLike(user_id=current_user.user_id, deck_id=deck_id))
    deck.like_count = (deck.like_count or 0) + 1
    
    # Notify deck owner
    create_notification(
        db=db,
        recipient_id=deck.user_id,
        actor_id=current_user.user_id,
        notif_type="LIKE",
        message=f"@{current_user.username} liked your deck '{deck.title}'",
        entity_type="DECK",
        entity_id=deck.deck_id
    )
    
    db.commit()
    return {"liked": True, "like_count": deck.like_count}


@deck_share_router.delete("/{deck_id}/like", status_code=status.HTTP_200_OK)
def unlike_deck(
    deck_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    like = db.query(DeckLike).filter(
        DeckLike.deck_id == deck_id, DeckLike.user_id == current_user.user_id
    ).first()
    if not like:
        raise HTTPException(status_code=404, detail="Like not found")

    deck = db.query(Deck).filter(Deck.deck_id == deck_id).first()
    db.delete(like)
    if deck:
        deck.like_count = max(0, (deck.like_count or 1) - 1)
    db.commit()
    return {"liked": False, "like_count": deck.like_count if deck else 0}


# ─── Deck Comments ─────────────────────────────────────────────────────────────

from pydantic import BaseModel

class DeckCommentCreateSchema(BaseModel):
    body: str

@deck_share_router.get("/{deck_id}/comments")
def get_deck_comments(
    deck_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.all_models import DeckComment
    comments = db.query(DeckComment).filter(DeckComment.deck_id == deck_id).order_by(DeckComment.created_at.asc()).all()
    
    def serialize_comment(c):
        return {
            "comment_id": str(c.comment_id),
            "body": c.body,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "author_username": c.author.username if c.author else "Anonymous",
            "author_id": str(c.author_id),
            "parent_comment_id": str(c.parent_comment_id) if c.parent_comment_id else None
        }
        
    return [serialize_comment(c) for c in comments]

@deck_share_router.post("/{deck_id}/comments")
def add_deck_comment(
    deck_id: uuid.UUID,
    payload: DeckCommentCreateSchema,
    parent_comment_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.all_models import DeckComment
    deck = db.query(Deck).filter(Deck.deck_id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
        
    comment = DeckComment(
        deck_id=deck_id,
        author_id=current_user.user_id,
        body=payload.body,
        parent_comment_id=parent_comment_id
    )
    db.add(comment)
    deck.comment_count = (deck.comment_count or 0) + 1
    
    if deck.user_id != current_user.user_id:
        create_notification(
            db=db,
            recipient_id=deck.user_id,
            actor_id=current_user.user_id,
            notif_type="COMMENT",
            message=f"@{current_user.username} commented on your deck '{deck.title}'",
            entity_type="DECK",
            entity_id=deck.deck_id
        )
        
    db.commit()
    db.refresh(comment)
    
    return {
        "comment_id": str(comment.comment_id),
        "body": comment.body,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "author_username": current_user.username,
        "author_id": str(current_user.user_id),
        "parent_comment_id": str(comment.parent_comment_id) if comment.parent_comment_id else None
    }



# ─── Phase 3: Pull Requests ───────────────────────────────────────────────────

@deck_share_router.post("/{deck_id}/pull-request", response_model=PullRequestResponse)
def create_pull_request(
    deck_id: uuid.UUID,
    pr_data: PullRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a PR from a forked deck to the original deck."""
    forked_deck = db.query(Deck).filter(Deck.deck_id == deck_id, Deck.user_id == current_user.user_id).first()
    if not forked_deck:
        raise HTTPException(status_code=404, detail="Forked deck not found or you don't own it")
    
    if not forked_deck.original_deck_id:
        raise HTTPException(status_code=400, detail="This deck is not a fork")

    original_deck = db.query(Deck).filter(Deck.deck_id == forked_deck.original_deck_id).first()
    if not original_deck:
        raise HTTPException(status_code=404, detail="Original deck no longer exists")

    # Check if a pending PR already exists
    existing = db.query(PullRequest).filter(
        PullRequest.forked_deck_id == deck_id,
        PullRequest.status == "PENDING"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A pending pull request already exists for this fork")

    # Calculate new cards
    orig_cards_set = {(c.front_text, c.back_text) for c in original_deck.cards}
    new_cards = []
    for c in forked_deck.cards:
        if (c.front_text, c.back_text) not in orig_cards_set:
            new_cards.append(c)
            orig_cards_set.add((c.front_text, c.back_text))

    if len(new_cards) == 0:
        raise HTTPException(status_code=400, detail="No new cards to merge")

    pr = PullRequest(
        original_deck_id=original_deck.deck_id,
        forked_deck_id=forked_deck.deck_id,
        author_id=current_user.user_id,
        message=pr_data.message,
        status="PENDING"
    )
    db.add(pr)
    
    # Notify original owner
    create_notification(
        db=db,
        recipient_id=original_deck.user_id,
        actor_id=current_user.user_id,
        notif_type="PR_SUBMITTED",
        message=f"@{current_user.username} submitted a Pull Request to your deck '{original_deck.title}'",
        entity_type="PULL_REQUEST",
        entity_id=pr.pr_id
    )

    db.commit()
    db.refresh(pr)

    return PullRequestResponse(
        pr_id=pr.pr_id,
        original_deck_id=pr.original_deck_id,
        forked_deck_id=pr.forked_deck_id,
        author_id=pr.author_id,
        author_username=current_user.username,
        status=pr.status,
        message=pr.message,
        created_at=pr.created_at,
        new_cards_count=len(new_cards),
        new_cards=new_cards
    )

@deck_share_router.get("/{deck_id}/pull-requests", response_model=list[PullRequestResponse])
def get_pull_requests(
    deck_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Gets all PENDING pull requests targeting the specified original deck."""
    deck = db.query(Deck).filter(Deck.deck_id == deck_id, Deck.user_id == current_user.user_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found or you are not the owner")

    prs = db.query(PullRequest).filter(
        PullRequest.original_deck_id == deck_id,
        PullRequest.status == "PENDING"
    ).all()

    responses = []
    for pr in prs:
        orig_cards_set = {(c.front_text, c.back_text) for c in pr.original_deck.cards}
        new_cards = []
        for c in pr.forked_deck.cards:
            if (c.front_text, c.back_text) not in orig_cards_set:
                new_cards.append(c)
                orig_cards_set.add((c.front_text, c.back_text))
                
        responses.append(PullRequestResponse(
            pr_id=pr.pr_id,
            original_deck_id=pr.original_deck_id,
            forked_deck_id=pr.forked_deck_id,
            author_id=pr.author_id,
            author_username=pr.author.username if pr.author else None,
            status=pr.status,
            message=pr.message,
            created_at=pr.created_at,
            new_cards_count=len(new_cards),
            new_cards=new_cards
        ))
    return responses

@deck_share_router.post("/pull-requests/{pr_id}/approve")
def approve_pull_request(
    pr_id: uuid.UUID,
    payload: PullRequestApproveRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pr = db.query(PullRequest).filter(PullRequest.pr_id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Pull Request not found")
    
    if pr.original_deck.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the owner of the original deck can approve PRs")

    if pr.status != "PENDING":
        raise HTTPException(status_code=400, detail="Pull Request is not PENDING")

    # Merge cards
    fork_cards = pr.forked_deck.cards
    orig_cards_set = {(c.front_text, c.back_text) for c in pr.original_deck.cards}

    added_count = 0
    from datetime import timezone
    
    # If specific card_ids provided, filter. Otherwise, merge all new cards.
    allowed_card_ids = set(payload.card_ids) if (payload and payload.card_ids is not None) else None

    new_cards_to_sync = []

    for card in fork_cards:
        if allowed_card_ids is not None and card.card_id not in allowed_card_ids:
            continue
            
        card_tuple = (card.front_text, card.back_text)
        if card_tuple not in orig_cards_set:
            new_cards_to_sync.append(card)
            new_card = Card(
                deck_id=pr.original_deck.deck_id,
                front_text=card.front_text,
                back_text=card.back_text,
            )
            db.add(new_card)
            db.flush()
            sched = Schedule(
                card_id=new_card.card_id,
                next_review_date=datetime.now(timezone.utc).date(),
            )
            db.add(sched)
            added_count += 1
            orig_cards_set.add(card_tuple) # In case duplicates inside fork

    # Automatically add these newly merged cards to all forked decks
    if new_cards_to_sync:
        forked_decks = db.query(Deck).filter(Deck.original_deck_id == pr.original_deck.deck_id).all()
        for fdeck in forked_decks:
            fdeck_cards_set = {(c.front_text, c.back_text) for c in fdeck.cards}
            for card in new_cards_to_sync:
                card_tuple = (card.front_text, card.back_text)
                if card_tuple not in fdeck_cards_set:
                    new_fcard = Card(
                        deck_id=fdeck.deck_id,
                        front_text=card.front_text,
                        back_text=card.back_text,
                    )
                    db.add(new_fcard)
                    db.flush()
                    db.add(Schedule(
                        card_id=new_fcard.card_id,
                        next_review_date=datetime.now(timezone.utc).date()
                    ))
                    fdeck_cards_set.add(card_tuple)

    pr.status = "APPROVED"
    
    # Notify author
    create_notification(
        db=db,
        recipient_id=pr.author_id,
        actor_id=current_user.user_id,
        notif_type="PR_APPROVED",
        message=f"@{current_user.username} approved your Pull Request! {added_count} cards were merged.",
        entity_type="PULL_REQUEST",
        entity_id=pr.pr_id
    )

    db.commit()
    return {"status": "APPROVED", "added_cards": added_count}

@deck_share_router.post("/pull-requests/{pr_id}/reject")
def reject_pull_request(
    pr_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pr = db.query(PullRequest).filter(PullRequest.pr_id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Pull Request not found")
    
    if pr.original_deck.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the owner of the original deck can reject PRs")

    if pr.status != "PENDING":
        raise HTTPException(status_code=400, detail="Pull Request is not PENDING")

    pr.status = "REJECTED"
    
    # Notify author
    create_notification(
        db=db,
        recipient_id=pr.author_id,
        actor_id=current_user.user_id,
        notif_type="PR_REJECTED",
        message=f"@{current_user.username} rejected your Pull Request.",
        entity_type="PULL_REQUEST",
        entity_id=pr.pr_id
    )

    db.commit()
    return {"status": "REJECTED"}
