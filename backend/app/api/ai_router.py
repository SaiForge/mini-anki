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
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List

from app.models.all_models import User
from app.api.deps import get_current_user
from app.services.ai_service import AIService
from app.db.database import get_db
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/ai", tags=["AI Companion"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "model"
    text: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


class ExplainRequest(BaseModel):
    concept: str
    context: Optional[str] = None


class QuizRequest(BaseModel):
    topic: str
    count: int = 3


class SummarizeRequest(BaseModel):
    text: str


# ─── Gemini helper ────────────────────────────────────────────────────────────

def _call_gemini(prompt: str, system_instruction: str = "") -> str:
    """Call Gemini 2.0 Flash via REST API. Returns text response."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not configured")

    import urllib.request
    import urllib.error

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

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
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.load(resp)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        if e.code == 429:
            raise HTTPException(
                status_code=429,
                detail="Gemini rate limit reached. Please wait a moment and try again."
            )
        elif e.code == 400:
            raise HTTPException(status_code=400, detail=f"Invalid request to Gemini: {body[:200]}")
        elif e.code == 403:
            raise HTTPException(status_code=403, detail="Gemini API key is invalid or lacks permissions.")
        else:
            raise HTTPException(status_code=502, detail=f"Gemini API error {e.code}: {body[:200]}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service unreachable: {str(e)}")

    try:
        return result["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise ValueError("Unexpected Gemini response format")



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
def chat(
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
            raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    return {"reply": reply, "role": "model"}


@router.post("/explain")
def explain_concept(
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
        raise HTTPException(status_code=502, detail=str(e))

    return {"explanation": reply}


@router.post("/quiz")
def generate_quiz(
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
        raise HTTPException(status_code=502, detail=str(e))

    return {"topic": req.topic, "questions": questions}


@router.post("/summarize")
def summarize(
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
        raise HTTPException(status_code=502, detail=str(e))

    return {"summary": reply}


# ─── Card Generation Schemas ──────────────────────────────────────────────────

class GenerateCardsRequest(BaseModel):
    topic: str
    count: int = 5


class ExtractCardsRequest(BaseModel):
    text: str
    count: int = 10


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
    count = min(req.count, 20)
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
            raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    return {"topic": req.topic, "cards": cards}


@router.post("/extract-cards")
def extract_cards_from_text(
    req: ExtractCardsRequest,
    current_user: User = Depends(get_current_user),
):
    """Extract flashcard pairs from a block of text using AI."""
    count = min(req.count, 30)
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
            raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

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
        raise HTTPException(status_code=422, detail=f"Could not parse PDF: {str(e)}")

    if not extracted_text:
        raise HTTPException(status_code=422, detail="No readable text found in the PDF.")

    count = min(count, 30)
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
            raise HTTPException(status_code=502, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    return {
        "filename": file.filename,
        "pages_read": len(reader.pages),
        "cards": cards,
    }


class GeneratePromptRequest(BaseModel):
    prompt: str

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

