# app/api/ai_router.py
"""
Phase 5: AI Study Companion
POST /api/ai/chat        - chat with the study companion
POST /api/ai/explain     - explain a concept / card
POST /api/ai/quiz        - generate quiz questions from a deck/topic
POST /api/ai/summarize   - summarize a study topic

Uses GEMINI_API_KEY env var. Falls back to smart mock responses if key not set.
"""
import os
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, List

from app.models.all_models import User, AISession
from app.schemas.ai_session_schema import AISessionCreate, AISessionUpdate, AISessionResponse
from app.api.deps import get_current_user
from app.services.ai_service import AIService
from app.db.database import get_db
from sqlalchemy.orm import Session
# SECURITY FIX (Critical #4): Rate limiting on AI endpoints
from app.core.limiter import limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ai", tags=["AI Companion"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


# ─── Schemas ──────────────────────────────────────────────────────────────────
# SECURITY FIX (Medium #10): Bounded input fields on all AI schemas.
# WHY: Unbounded inputs let one user send 50,000-char prompts per request,
# exhausting the Gemini API quota and running up costs for everyone.

class ChatMessage(BaseModel):
    role: str = Field(..., max_length=10)   # "user" or "model"
    text: str = Field(..., max_length=2000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    # Cap history at 20 turns — beyond that, context isn’t helpful and tokens are expensive
    history: Optional[List[ChatMessage]] = Field(default=[], max_items=20)


class ExplainRequest(BaseModel):
    concept: str = Field(..., min_length=1, max_length=1000)
    context: Optional[str] = Field(None, max_length=2000)


class QuizRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    count: int = Field(3, ge=1, le=10)


class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)


# ─── Gemini helper ────────────────────────────────────────────────────────────

def _call_gemini(prompt: str, system_instruction: str = "") -> str:
    """Call Gemini 2.0 Flash via REST API with fallbacks. Returns text response."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not configured")

    import urllib.request
    import urllib.error

    MODELS = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-3.0-flash",
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
        "gemma-4-31b",
        "gemma-4-26b"
    ]

    contents = [{"role": "user", "parts": [{"text": prompt}]}]
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 2048,
        },
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    data = json.dumps(payload).encode("utf-8")
    
    last_error_e = None
    last_error_body = None

    for model in MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.load(resp)
                try:
                    return result["candidates"][0]["content"]["parts"][0]["text"]
                except (KeyError, IndexError):
                    raise ValueError("Unexpected Gemini response format")
        except urllib.error.HTTPError as e:
            last_error_e = e
            last_error_body = e.read().decode("utf-8", errors="replace")
            # If rate limited (429) or server error (5xx), fallback to next model
            if e.code in (429, 500, 502, 503, 504):
                print(f"Model {model} failed with {e.code}, falling back...")
                continue
            # For 400 or 403, we shouldn't retry as it's likely a bad request/key
            break
        except Exception as e:
            last_error_e = e
            print(f"Model {model} failed with {str(e)}, falling back...")
            continue

    if isinstance(last_error_e, urllib.error.HTTPError):
        if last_error_e.code == 429:
            raise HTTPException(
                status_code=429,
                detail="Gemini rate limit reached on all fallback models. Please wait a moment and try again."
            )
        elif last_error_e.code == 400:
            raise HTTPException(status_code=400, detail=f"Invalid request to Gemini: {last_error_body[:200] if last_error_body else ''}")
        elif last_error_e.code == 403:
            raise HTTPException(status_code=403, detail="Gemini API key is invalid or lacks permissions.")
        else:
            raise HTTPException(status_code=502, detail=f"Gemini API error {last_error_e.code}: {last_error_body[:200] if last_error_body else ''}")
    elif last_error_e:
        raise HTTPException(status_code=502, detail=f"AI service unreachable: {str(last_error_e)}")
        
    raise ValueError("Unexpected error in Gemini service.")



SYSTEM_PROMPT = """You are a brilliant AI study companion inside StudyLab, a spaced-repetition social learning platform.
Your role is to help users understand concepts deeply, generate quiz questions, explain topics clearly,
and motivate consistent study habits. Be concise, use examples, and format responses in markdown when helpful.
Always stay on-topic and educational."""


def _fallback_response(topic: str) -> str:
    """Smart mock response when Gemini API is not configured."""
    responses = {
        "default": f"Great question about **{topic}**! This is a fundamental concept worth exploring deeply. Break it into smaller components and use spaced repetition to reinforce each part. Consider creating flashcards for the key definitions and examples.",
    }
    return responses.get("default", responses["default"])


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/chat")
# SECURITY: 30 AI calls per IP per minute — prevents quota exhaustion
@limiter.limit("30/minute")
def chat(
    request: Request,
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    """Multi-turn chat with the AI study companion."""
    # Build prompt with history
    history_text = ""
    for msg in (req.history or [])[-10:]:  # last 10 turns max
        role_label = "User" if msg.role == "user" else "Assistant"
        history_text += f"\n{role_label}: {msg.text}"

    prompt = f"{history_text}\nUser: {req.message}\nAssistant:"

    try:
        reply = _call_gemini(prompt, system_instruction=SYSTEM_PROMPT)
    except ValueError as e:
        if "GEMINI_API_KEY" in str(e):
            reply = _fallback_response(req.message)
        else:
            raise HTTPException(status_code=502, detail="AI service error. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("AI chat error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable.")

    return {"reply": reply, "role": "model"}


@router.post("/explain")
@limiter.limit("30/minute")
def explain_concept(
    request: Request,
    req: ExplainRequest,
    current_user: User = Depends(get_current_user),
):
    """Explain a concept in simple terms with examples."""
    ctx = f"\nContext: {req.context}" if req.context else ""
    prompt = f"Explain this concept clearly for a student using examples and analogies:{ctx}\n\nConcept: {req.concept}"

    try:
        reply = _call_gemini(prompt, system_instruction=SYSTEM_PROMPT)
    except ValueError:
        reply = f"**{req.concept}** is a key concept. Break it down by:\n1. Core definition\n2. A real-world analogy\n3. Common misconceptions\n\nPractice recalling it without notes — that's where real learning happens."
    except HTTPException:
        raise
    except Exception as e:
        logger.error("AI explain error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable.")

    return {"explanation": reply}


@router.post("/quiz")
@limiter.limit("20/minute")
def generate_quiz(
    request: Request,
    req: QuizRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate quiz questions for a topic."""
    count = min(req.count, 10)
    prompt = (
        f"Generate exactly {count} quiz questions about '{req.topic}' for a student. "
        f"For each question, provide: question text, 4 answer options (A/B/C/D), and the correct answer letter. "
        f"Format as JSON array: [{{'question': '...', 'options': {{'A': '...', 'B': '...', 'C': '...', 'D': '...'}}, 'answer': 'A'}}]"
    )

    try:
        raw = _call_gemini(prompt, system_instruction=SYSTEM_PROMPT)
        # Extract JSON from response
        import re
        json_match = re.search(r'\[.*\]', raw, re.DOTALL)
        if json_match:
            questions = json.loads(json_match.group())
        else:
            questions = json.loads(raw)
    except ValueError:
        # Fallback questions
        questions = [
            {
                "question": f"What is the primary purpose of {req.topic}?",
                "options": {"A": "To organize data", "B": "To process information efficiently", "C": "To store long-term memory", "D": "To communicate between systems"},
                "answer": "B"
            }
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("AI quiz error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable.")

    return {"topic": req.topic, "questions": questions}


@router.post("/summarize")
@limiter.limit("30/minute")
def summarize(
    request: Request,
    req: SummarizeRequest,
    current_user: User = Depends(get_current_user),
):
    """Summarize a block of text or concept notes."""
    prompt = f"Summarize the following study material into clear bullet points, highlighting the most important concepts:\n\n{req.text[:3000]}"

    try:
        reply = _call_gemini(prompt, system_instruction=SYSTEM_PROMPT)
    except ValueError:
        # Fallback: extract first sentences
        sentences = req.text.split(". ")[:3]
        reply = "**Key points:**\n" + "\n".join(f"- {s.strip()}" for s in sentences if s.strip())
    except HTTPException:
        raise
    except Exception as e:
        logger.error("AI summarize error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable.")

    return {"summary": reply}


# ─── Card Generation Schemas ──────────────────────────────────────────────────

class GenerateCardsRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    count: int = Field(5, ge=1, le=15)


class ExtractCardsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)
    count: int = Field(10, ge=1, le=15)


# ─── Card Generation Helpers ──────────────────────────────────────────────────

CARD_SYSTEM_PROMPT = """You are a flashcard generation expert inside a spaced-repetition app called mini-anki.
Generate high-quality, concise flashcard pairs. Each card front should be a clear question or term,
and the back should be a precise, memorable answer. Output ONLY valid JSON — no markdown fences, no commentary."""


def _parse_cards(raw: str) -> list:
    """Try to parse a JSON array of {front, back} card objects from an AI response."""
    import re
    # Try to find a JSON array in the response
    json_match = re.search(r'\[.*\]', raw, re.DOTALL)
    if json_match:
        cards = json.loads(json_match.group())
    else:
        cards = json.loads(raw)
    # Normalize keys — AI sometimes returns "question"/"answer" or "term"/"definition"
    normalized = []
    for c in cards:
        if isinstance(c, dict):
            front = c.get("front") or c.get("question") or c.get("term") or c.get("Front") or ""
            back = c.get("back") or c.get("answer") or c.get("definition") or c.get("Back") or ""
            if front and back:
                normalized.append({"front": str(front).strip(), "back": str(back).strip()})
    return normalized


def _fallback_cards(topic: str, count: int) -> list:
    """Return placeholder cards when AI is unavailable."""
    return [
        {
            "front": f"What is the key concept behind {topic}?",
            "back": f"{topic} involves understanding core principles and applying them consistently through spaced repetition practice.",
        }
        for _ in range(min(count, 3))
    ]


# ─── New Endpoints ────────────────────────────────────────────────────────────

@router.post("/generate-cards")
def generate_cards(
    req: GenerateCardsRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate N flashcard pairs for a given topic using AI."""
    count = min(req.count, 15)
    prompt = (
        f"Generate exactly {count} high-quality flashcard pairs about the topic: '{req.topic}'.\n"
        f"Each card should test a distinct concept. Use clear, concise language.\n"
        f"Output a JSON array ONLY, in this exact format:\n"
        f'[{{"front": "Question or term here", "back": "Answer or definition here"}}, ...]'
    )
    try:
        raw = _call_gemini(prompt, system_instruction=CARD_SYSTEM_PROMPT)
        cards = _parse_cards(raw)
        if not cards:
            raise ValueError("No cards parsed")
    except ValueError as e:
        if "GEMINI_API_KEY" in str(e) or "No cards" in str(e):
            cards = _fallback_cards(req.topic, count)
        else:
            raise HTTPException(status_code=502, detail="AI service error. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("AI generate-cards error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable.")

    return {"topic": req.topic, "cards": cards}


@router.post("/extract-cards")
def extract_cards_from_text(
    req: ExtractCardsRequest,
    current_user: User = Depends(get_current_user),
):
    """Extract flashcard pairs from a block of text using AI."""
    count = min(req.count, 15)
    truncated = req.text[:4000]
    prompt = (
        f"Extract up to {count} meaningful flashcard pairs from the following text.\n"
        f"Each card should capture a key fact, concept, term, or relationship from the text.\n"
        f"Output a JSON array ONLY:\n"
        f'[{{"front": "Question or term", "back": "Answer or explanation"}}, ...]\n\n'
        f"TEXT:\n{truncated}"
    )
    try:
        raw = _call_gemini(prompt, system_instruction=CARD_SYSTEM_PROMPT)
        cards = _parse_cards(raw)
        if not cards:
            raise ValueError("No cards parsed")
    except ValueError as e:
        if "GEMINI_API_KEY" in str(e) or "No cards" in str(e):
            sentences = [s.strip() for s in req.text.split(". ") if len(s.strip()) > 20]
            cards = [{"front": f"What does this mean: '{s[:80]}...'?", "back": s} for s in sentences[:3]]
        else:
            raise HTTPException(status_code=502, detail="AI service error. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("AI extract-cards error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable.")

    return {"cards": cards}


@router.post("/extract-cards-pdf")
async def extract_cards_from_pdf(
    file: UploadFile = File(...),
    count: int = 15,
    current_user: User = Depends(get_current_user),
):
    """Upload a PDF file and extract flashcard pairs from its text content."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    MAX_PDF_SIZE = 10 * 1024 * 1024  # 10 MB
    contents = await file.read()
    if len(contents) > MAX_PDF_SIZE:
        raise HTTPException(status_code=413, detail="PDF too large. Maximum size is 10 MB.")

    # Extract text using pypdf
    try:
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(contents))
        text_parts = []
        for page in reader.pages[:30]:  # cap at 30 pages
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        extracted_text = "\n".join(text_parts).strip()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("PDF parse error: %s", e, exc_info=True)
        raise HTTPException(status_code=422, detail="Could not parse PDF. Ensure it contains readable text.")

    if not extracted_text:
        raise HTTPException(status_code=422, detail="No readable text found in the PDF.")

    count = min(count, 15)
    truncated = extracted_text[:5000]
    prompt = (
        f"Extract up to {count} high-quality flashcard pairs from this PDF content.\n"
        f"Focus on key concepts, definitions, facts, and important relationships.\n"
        f"Output a JSON array ONLY:\n"
        f'[{{"front": "Question or term", "back": "Answer or explanation"}}, ...]\n\n'
        f"PDF CONTENT:\n{truncated}"
    )

    try:
        raw = _call_gemini(prompt, system_instruction=CARD_SYSTEM_PROMPT)
        cards = _parse_cards(raw)
        if not cards:
            raise ValueError("No cards parsed")
    except ValueError as e:
        if "GEMINI_API_KEY" in str(e) or "No cards" in str(e):
            sentences = [s.strip() for s in extracted_text.split(". ") if len(s.strip()) > 20]
            cards = [{"front": f"What does this mean: '{s[:80]}...'?", "back": s} for s in sentences[:3]]
        else:
            raise HTTPException(status_code=502, detail="AI service error. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("AI extract-pdf error: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail="AI service temporarily unavailable.")

    return {
        "filename": file.filename,
        "pages_read": len(reader.pages),
        "cards": cards,
    }


class GeneratePromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)

@router.post("/generate")
def generate_flashcards(
    req: GeneratePromptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate flashcards from a prompt and automatically save them as Posts."""
    try:
        posts = AIService.generate_flashcards(db, req.prompt, current_user.user_id)
        # return basic post info
        return [
            {
                "post_id": str(p.post_id),
                "title": p.title,
                "body": p.body,
                "created_at": p.created_at.isoformat() if p.created_at else None
            }
            for p in posts
        ]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ─── AI Sessions CRUD ─────────────────────────────────────────────────────────

@router.get("/sessions", response_model=List[AISessionResponse])
def get_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all AI sessions for current user."""
    sessions = db.query(AISession).filter(AISession.user_id == current_user.user_id).order_by(AISession.updated_at.desc()).all()
    return sessions

@router.post("/sessions", response_model=AISessionResponse)
def create_session(
    session_in: AISessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new AI session."""
    db_session = AISession(
        user_id=current_user.user_id,
        mode=session_in.mode,
        title=session_in.title,
        data=session_in.data
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@router.get("/sessions/{session_id}", response_model=AISessionResponse)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific AI session."""
    session = db.query(AISession).filter(AISession.session_id == session_id, AISession.user_id == current_user.user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.put("/sessions/{session_id}", response_model=AISessionResponse)
def update_session(
    session_id: str,
    session_in: AISessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an AI session."""
    session = db.query(AISession).filter(AISession.session_id == session_id, AISession.user_id == current_user.user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session_in.title is not None:
        session.title = session_in.title
    if session_in.data is not None:
        session.data = session_in.data
        
    db.commit()
    db.refresh(session)
    return session

@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an AI session."""
    session = db.query(AISession).filter(AISession.session_id == session_id, AISession.user_id == current_user.user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    db.delete(session)
    db.commit()
    return {"message": "Session deleted"}

