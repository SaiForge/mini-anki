import os
import json
import urllib.request
import urllib.error
from sqlalchemy.orm import Session
from app.models.all_models import Post
import uuid

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

class AIService:
    @staticmethod
    def generate_flashcards(db: Session, prompt: str, user_id: uuid.UUID) -> list[Post]:
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        
        system_instruction = (
            "You are a flashcard generator. You must generate flashcards based on the user prompt. "
            "Return EXACTLY a JSON array of objects, where each object has 'front_text' and 'back_text' string keys."
        )

        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "generationConfig": {
                "temperature": 0.7,
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "front_text": {"type": "STRING"},
                            "back_text": {"type": "STRING"}
                        },
                        "required": ["front_text", "back_text"]
                    }
                }
            }
        }

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.load(resp)
                content = result["candidates"][0]["content"]["parts"][0]["text"]
                cards = json.loads(content)
        except Exception as e:
            raise ValueError(f"AI generation failed: {str(e)}")

        posts = []
        for card in cards:
            post = Post(
                author_id=user_id,
                content_type="FLASHCARD",
                title=card["front_text"][:200],  # Title is limited to 200 chars
                body=card["back_text"],
                is_private=False
            )
            db.add(post)
            posts.append(post)
            
        db.commit()
        for p in posts:
            db.refresh(p)
            
        return posts
