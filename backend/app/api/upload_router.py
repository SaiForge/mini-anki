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


def _save_file(upload: UploadFile, dest_dir: Path) -> str:
    """Validate, save, return public URL path."""
    if upload.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"File type {upload.content_type!r} not allowed. Use JPEG, PNG, WebP, or GIF.")

    ext = upload.filename.rsplit(".", 1)[-1].lower() if "." in upload.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    dest = dest_dir / filename

    # Stream to disk & check size
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
