# app/models/all_models.py
from sqlalchemy import Column, String, Integer, Date, DateTime, ForeignKey, Text, Boolean, JSON, UniqueConstraint, func
# pyrefly: ignore [missing-import]
from sqlalchemy import Uuid as UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, index=True, nullable=True)
    google_sub = Column(String(255), unique=True, index=True, nullable=True)
    full_name = Column(String(100), nullable=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    bio = Column(Text, nullable=True)
    website_url = Column(String(255), nullable=True)
    location = Column(String(100), nullable=True)
    is_public = Column(Boolean, default=True)
    tags = Column(JSON, nullable=True)  # Store expertise tags
    gender = Column(String(50), nullable=True)
    dob = Column(Date, nullable=True)
    role = Column(String(100), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Streak tracking
    current_streak = Column(Integer, default=0, nullable=False)
    last_review_date = Column(Date, nullable=True)

    # Relationships
    decks = relationship("Deck", back_populates="owner", cascade="all, delete-orphan")


class Follow(Base):
    __tablename__ = "follows"

    follow_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    follower_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)  # who is following
    following_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)  # who is being followed
    created_at = Column(DateTime, default=datetime.utcnow)

    # Unique constraint: a user can only follow another user once
    __table_args__ = (UniqueConstraint('follower_id', 'following_id'),)


class Deck(Base):
    __tablename__ = "decks"

    deck_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)
    tags = Column(JSON, nullable=True)
    original_deck_id = Column(UUID(as_uuid=True), ForeignKey("decks.deck_id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_default = Column(Integer, default=0, nullable=False)
    
    # Phase 3: Social/Sharing stats
    is_public = Column(Boolean, default=False)
    fork_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)

    # Relationships
    owner = relationship("User", foreign_keys=[user_id])
    cards = relationship("Card", back_populates="deck", cascade="all, delete-orphan")
    deck_likes = relationship("DeckLike", back_populates="deck", cascade="all, delete-orphan")
    comments = relationship("DeckComment", back_populates="deck", cascade="all, delete-orphan")


class DeckLike(Base):
    __tablename__ = "deck_likes"

    like_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    deck_id = Column(UUID(as_uuid=True), ForeignKey("decks.deck_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint('user_id', 'deck_id'),)

    # Relationships
    deck = relationship("Deck", back_populates="deck_likes")
    user = relationship("User", foreign_keys=[user_id])


class Card(Base):
    __tablename__ = "cards"

    card_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deck_id = Column(
        UUID(as_uuid=True),
        ForeignKey("decks.deck_id", ondelete="CASCADE"),
        nullable=False,
    )
    front_text = Column(Text, nullable=False)
    back_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    deck = relationship("Deck", back_populates="cards")
    schedule = relationship(
        "Schedule", back_populates="card", uselist=False, cascade="all, delete-orphan"
    )
    review_logs = relationship(
        "ReviewLog", back_populates="card", cascade="all, delete-orphan"
    )


class Schedule(Base):
    __tablename__ = "schedules"

    schedule_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cards.card_id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    next_review_date = Column(Date, nullable=False)
    current_interval_days = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    card = relationship("Card", back_populates="schedule")


class ReviewLog(Base):
    __tablename__ = "review_logs"

    log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cards.card_id", ondelete="CASCADE"),
        nullable=False,
    )
    grade_submitted = Column(
        String(10), nullable=False
    )  # 'Again', 'Hard', 'Good', 'Easy'
    reviewed_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    card = relationship("Card", back_populates="review_logs")


# ─── Phase 2: Content Feed & Interactions ─────────────────────────────────────

class Post(Base):
    __tablename__ = "posts"

    post_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    content_type = Column(String(20), default="CONCEPT")  # CONCEPT, JOKE, RIDDLE, FLASHCARD, QUOTE
    title = Column(String(200), nullable=True)
    body = Column(Text, nullable=False)
    code_snippet = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    category = Column(String(50), nullable=True)
    is_private = Column(Boolean, default=False)
    deck_id = Column(UUID(as_uuid=True), ForeignKey("decks.deck_id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    author = relationship("User", foreign_keys=[author_id])
    likes = relationship("PostLike", back_populates="post", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")


class PostLike(Base):
    __tablename__ = "post_likes"

    like_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.post_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint('user_id', 'post_id'),)

    # Relationships
    post = relationship("Post", back_populates="likes")
    user = relationship("User", foreign_keys=[user_id])


class Bookmark(Base):
    __tablename__ = "bookmarks"

    bookmark_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.post_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint('user_id', 'post_id'),)

    # Relationships
    post = relationship("Post", back_populates="bookmarks")
    user = relationship("User", foreign_keys=[user_id])


class Comment(Base):
    __tablename__ = "comments"

    comment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(UUID(as_uuid=True), ForeignKey("posts.post_id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    parent_comment_id = Column(UUID(as_uuid=True), ForeignKey("comments.comment_id"), nullable=True)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    post = relationship("Post", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])
    parent = relationship("Comment", back_populates="replies", remote_side="Comment.comment_id")
    replies = relationship("Comment", back_populates="parent")

class DeckComment(Base):
    __tablename__ = "deck_comments"

    comment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deck_id = Column(UUID(as_uuid=True), ForeignKey("decks.deck_id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    parent_comment_id = Column(UUID(as_uuid=True), ForeignKey("deck_comments.comment_id"), nullable=True)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    deck = relationship("Deck", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])
    parent = relationship("DeckComment", back_populates="replies", remote_side="DeckComment.comment_id")
    replies = relationship("DeckComment", back_populates="parent")


# ── Phase 4: Notifications ─────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    
    # Type: LIKE | COMMENT | FOLLOW | DECK_FORK | REPLY | BOOKMARK | SYSTEM | PR_SUBMITTED | PR_APPROVED | PR_REJECTED
    type = Column(String(50), nullable=False)
    # What entity this is about: POST | DECK | COMMENT | USER | PULL_REQUEST
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    recipient = relationship("User", foreign_keys=[recipient_id])
    actor = relationship("User", foreign_keys=[actor_id])


class PullRequest(Base):
    __tablename__ = "pull_requests"

    pr_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    original_deck_id = Column(UUID(as_uuid=True), ForeignKey("decks.deck_id", ondelete="CASCADE"), nullable=False)
    forked_deck_id = Column(UUID(as_uuid=True), ForeignKey("decks.deck_id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    
    # PENDING | APPROVED | REJECTED
    status = Column(String(20), default="PENDING", nullable=False)
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    original_deck = relationship("Deck", foreign_keys=[original_deck_id])
    forked_deck = relationship("Deck", foreign_keys=[forked_deck_id])
    author = relationship("User", foreign_keys=[author_id])


# ── Phase 5: Direct Messages ────────────────────────────────────────────────

class DirectMessage(Base):
    __tablename__ = "direct_messages"

    message_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    is_edited = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])


# ── Phase 6: AI Sessions ──────────────────────────────────────────────────

class AISession(Base):
    __tablename__ = "ai_sessions"

    session_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    mode = Column(String(50), nullable=False)  # CHAT, GENERATE, EXTRACT_TEXT, UPLOAD_PDF, QUIZ
    title = Column(String(200), nullable=True)
    data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
