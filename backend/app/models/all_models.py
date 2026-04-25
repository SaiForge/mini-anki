# app/models/all_models.py
from sqlalchemy import Column, String, Integer, Date, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    decks = relationship("Deck", back_populates="owner", cascade="all, delete-orphan")

class Deck(Base):
    __tablename__ = "decks"

    deck_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"), nullable=False)
    title = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="decks")
    cards = relationship("Card", back_populates="deck", cascade="all, delete-orphan")

class Card(Base):
    __tablename__ = "cards"

    card_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deck_id = Column(UUID(as_uuid=True), ForeignKey("decks.deck_id", ondelete="CASCADE"), nullable=False)
    front_text = Column(Text, nullable=False)
    back_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    deck = relationship("Deck", back_populates="cards")
    schedule = relationship("Schedule", back_populates="card", uselist=False, cascade="all, delete-orphan")
    review_logs = relationship("ReviewLog", back_populates="card", cascade="all, delete-orphan")

class Schedule(Base):
    __tablename__ = "schedules"

    schedule_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id = Column(UUID(as_uuid=True), ForeignKey("cards.card_id", ondelete="CASCADE"), unique=True, nullable=False)
    next_review_date = Column(Date, nullable=False)
    current_interval_days = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    card = relationship("Card", back_populates="schedule")

class ReviewLog(Base):
    __tablename__ = "review_logs"

    log_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    card_id = Column(UUID(as_uuid=True), ForeignKey("cards.card_id", ondelete="CASCADE"), nullable=False)
    grade_submitted = Column(String(10), nullable=False) # 'Again', 'Hard', 'Good', 'Easy'
    reviewed_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    card = relationship("Card", back_populates="review_logs")
