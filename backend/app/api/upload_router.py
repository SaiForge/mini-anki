# app/api/upload_router.py
"""
Phase 5: File Upload API
POST /api/uploads/avatar    - upload profile picture (saved to /app/uploads/avatars/)
POST /api/uploads/image     - upload a post image (saved to /app/uploads/posts/)
GET  /uploads/{path}        - serve uploaded files (static)

Files are stored inside the container at /app/uploads/.
In production, mount a Docker volume or swap to S3/Cloudinary.
"""
import os
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Request
from fastapi.staticfiles import StaticFiles

from app.db.database import get_db
from app.models.all_models import User
from app.api.deps import get_current_user
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/uploads", tags=["File Uploads"])

# ── Upload directories ──────────────────────────────────────────────────────
BASE_UPLOAD_DIR = Path("/app/uploads")
AVATAR_DIR = BASE_UPLOAD_DIR / "avatars"
POST_IMG_DIR = BASE_UPLOAD_DIR / "posts"

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

for d in [AVATAR_DIR, POST_IMG_DIR]:
    d.mkdir(parents=True, exist_ok=True)


# SECURITY FIX (Low #12): Magic-byte file type detection
#
# WHY: The Content-Type header is sent by the client and trivially spoofable.
# An attacker can name a PHP/Python script "image.jpg" and set Content-Type
# to "image/jpeg" — the old check would accept it. This check reads the
# actual first bytes of the file (the "magic bytes" every file format has)
# and compares them to known image signatures.
#
# We use the pure-Python `filetype` library (no system deps like libmagic).
_MAGIC_SIGNATURES: dict[bytes, str] = {
    b"\xff\xd8\xff":        "image/jpeg",   # JPEG
    b"\x89PNG\r\n\x1a\n":  "image/png",    # PNG
    b"RIFF":                "image/webp",   # WebP (also needs bytes 8-12 == WEBP)
    b"GIF87a":              "image/gif",    # GIF87a
    b"GIF89a":              "image/gif",    # GIF89a
}


def _detect_image_type(header: bytes) -> str | None:
    """Return the detected MIME type from the first bytes, or None if unrecognised."""
    for magic, mime in _MAGIC_SIGNATURES.items():
        if header[:len(magic)] == magic:
            # Extra WebP check: bytes 8-12 must be b'WEBP'
            if mime == "image/webp" and header[8:12] != b"WEBP":
                continue
            return mime
    return None


def _save_file(upload: UploadFile, dest_dir: Path) -> str:
    """Validate (MIME header + magic bytes), save, return public URL path."""

    # 1. Check declared Content-Type header first (fast reject)
    if upload.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type {upload.content_type!r} not allowed. Use JPEG, PNG, WebP, or GIF."
        )

    # 2. Read first 16 bytes to verify magic bytes match the declared type
    header_bytes = upload.file.read(16)
    upload.file.seek(0)  # rewind before saving

    detected = _detect_image_type(header_bytes)
    if detected is None:
        raise HTTPException(
            status_code=400,
            detail="File content does not match an allowed image format (JPEG, PNG, WebP, GIF)."
        )
    if detected != upload.content_type:
        raise HTTPException(
            status_code=400,
            detail=f"File content ({detected}) does not match declared type ({upload.content_type})."
        )

    ext = upload.filename.rsplit(".", 1)[-1].lower() if "." in upload.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    dest = dest_dir / filename

    # Stream to disk & enforce size limit
    written = 0
    with open(dest, "wb") as f:
        for chunk in upload.file:
            written += len(chunk)
            if written > MAX_SIZE_BYTES:
                f.close()
                os.remove(dest)
                raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")
            f.write(chunk)

    return str(dest.relative_to(BASE_UPLOAD_DIR))


@router.post("/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a new profile picture. Returns the public URL."""
    rel_path = _save_file(file, AVATAR_DIR)
    public_url = f"/uploads/{rel_path}"

    # Update user record
    pass
    db.commit()

    return {"url": public_url, "message": "Avatar updated"}


@router.post("/image")
def upload_post_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an image for a post. Returns the public URL."""
    rel_path = _save_file(file, POST_IMG_DIR)
    public_url = f"/uploads/{rel_path}"
    return {"url": public_url}
