import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.all_models import User
from app.schemas.user_schema import (
    UserCreate,
    UserLogin,
    UserUpdate,
    UserResponse,
    Token,
    MessageResponse,
    UserEmailRequest,
    ResetPasswordRequest,
)
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.api.deps import get_current_user
from datetime import timedelta
from jose import JWTError, ExpiredSignatureError
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")

class GoogleAuthPayload(BaseModel):
    token: str

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")



def send_password_reset_email(email: str, token: str) -> None:
    reset_url = f"{FRONTEND_BASE_URL.rstrip('/')}/reset-password?token={token}"

    print("\n" + "="*50)
    print("🔔 [LOCAL OFFLINE MODE] PASSWORD RESET")
    print(f"To: {email}")
    print(f"Link: {reset_url}")
    print("="*50 + "\n")


@router.post(
    "/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED
)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    # Check if email already exists
    db_email = db.query(User).filter(User.email == user.email).first()
    if db_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check if username already exists
    if user.username:
        db_username = db.query(User).filter(User.username == user.username).first()
        if db_username:
            raise HTTPException(status_code=400, detail="Username already taken")

    # Hash password and create user
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email, 
        password_hash=hashed_password, 
        username=user.username,
        full_name=user.full_name,
        bio=user.bio,
        profile_picture_url=user.profile_picture_url,
        gender=user.gender,
        dob=user.dob,
        role=user.role,
        is_verified=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create default deck for the user
    from app.models.all_models import Deck

    default_deck = Deck(
        title="📚 Today's Review", user_id=new_user.user_id, is_default=1
    )
    db.add(default_deck)
    db.commit()

    return {"message": "User created successfully! You can now log in."}


@router.get("/check-username")
def check_username(username: str, db: Session = Depends(get_db)):
    # Check if a given username is available
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    db_user = db.query(User).filter(User.username == username).first()
    if db_user:
        return {"available": False}
    return {"available": True}


@router.post("/login", response_model=Token)
def login_user(user: UserLogin, db: Session = Depends(get_db)):
    # Find user
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )


    # Generate JWT
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(db_user.user_id)}, expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/google", response_model=Token)
def authenticate_with_google(payload: GoogleAuthPayload, db: Session = Depends(get_db)):
    try:
        idinfo = id_token.verify_oauth2_token(
            payload.token, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        google_sub = idinfo.get("sub")
        email = idinfo.get("email")
        name = idinfo.get("name")

        if not google_sub or not email:
            raise HTTPException(status_code=400, detail="Incomplete Google profile.")

        user = db.query(User).filter(User.email == email).first()

        if user:
            if not user.google_sub:
                user.google_sub = google_sub
                if not user.full_name and name:
                    user.full_name = name
                db.commit()
                db.refresh(user)
        else:
            hashed_password = get_password_hash(os.urandom(32).hex())
            user = User(
                email=email,
                google_sub=google_sub,
                full_name=name,
                password_hash=hashed_password,
                is_verified=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            from app.models.all_models import Deck
            default_deck = Deck(
                title="📚 Today's Review", user_id=user.user_id, is_default=1
            )
            db.add(default_deck)
            db.commit()

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.user_id)}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}

    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google Token. Authentication Failed.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")


@router.get("/me", response_model=UserResponse)
def get_user_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    followers_count = db.query(Follow).filter(Follow.following_id == current_user.user_id).count()
    following_count = db.query(Follow).filter(Follow.follower_id == current_user.user_id).count()
    
    current_user.followers_count = followers_count
    current_user.following_count = following_count
    return current_user


@router.put("/me", response_model=UserResponse)
def update_user_profile(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_update.username is not None:
        # Check if username already exists for another user
        if user_update.username != current_user.username:
            db_user = db.query(User).filter(User.username == user_update.username).first()
            if db_user:
                raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = user_update.username

    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name

    if user_update.bio is not None:
        current_user.bio = user_update.bio

    if user_update.profile_picture_url is not None:
        current_user.profile_picture_url = user_update.profile_picture_url

    if user_update.website_url is not None:
        current_user.website_url = user_update.website_url

    if user_update.location is not None:
        current_user.location = user_update.location

    if user_update.is_public is not None:
        current_user.is_public = user_update.is_public

    if user_update.tags is not None:
        current_user.tags = user_update.tags

    if user_update.role is not None:
        current_user.role = user_update.role

    if user_update.gender is not None:
        current_user.gender = user_update.gender

    if user_update.dob is not None:
        current_user.dob = user_update.dob

    db.commit()
    db.refresh(current_user)

    followers_count = db.query(Follow).filter(Follow.following_id == current_user.user_id).count()
    following_count = db.query(Follow).filter(Follow.follower_id == current_user.user_id).count()
    
    current_user.followers_count = followers_count
    current_user.following_count = following_count

    return current_user


@router.delete("/users/me")
def delete_current_user(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    import traceback as tb
    uid = str(current_user.user_id)
    print(f"[DELETE ACCOUNT] Starting deletion for user: {uid}")

    # Expunge all ORM objects from session and close to prevent any flush interference
    db.expunge_all()
    db.close()

    # Get a fresh raw psycopg2 connection from the engine directly
    from app.db.database import engine
    raw_conn = engine.raw_connection()
    cur = raw_conn.cursor()

    try:
        print("[DELETE ACCOUNT] Step 1: direct_messages")
        cur.execute("DELETE FROM direct_messages WHERE sender_id = %s::uuid OR recipient_id = %s::uuid", (uid, uid))
        print("[DELETE ACCOUNT] Step 2: notifications")
        cur.execute("DELETE FROM notifications WHERE recipient_id = %s::uuid OR actor_id = %s::uuid", (uid, uid))
        print("[DELETE ACCOUNT] Step 3: pull_requests")
        cur.execute("DELETE FROM pull_requests WHERE author_id = %s::uuid", (uid,))
        print("[DELETE ACCOUNT] Step 4: bookmarks")
        cur.execute("DELETE FROM bookmarks WHERE user_id = %s::uuid", (uid,))
        print("[DELETE ACCOUNT] Step 5: post_likes")
        cur.execute("DELETE FROM post_likes WHERE user_id = %s::uuid", (uid,))
        print("[DELETE ACCOUNT] Step 6: nullify comment replies (self-ref FK)")
        cur.execute("UPDATE comments SET parent_comment_id = NULL WHERE parent_comment_id IN (SELECT comment_id FROM comments WHERE author_id = %s::uuid)", (uid,))
        print("[DELETE ACCOUNT] Step 7: comments")
        cur.execute("DELETE FROM comments WHERE author_id = %s::uuid", (uid,))
        print("[DELETE ACCOUNT] Step 7: posts")
        cur.execute("DELETE FROM posts WHERE author_id = %s::uuid", (uid,))
        print("[DELETE ACCOUNT] Step 8: follows")
        cur.execute("DELETE FROM follows WHERE follower_id = %s::uuid OR following_id = %s::uuid", (uid, uid))
        print("[DELETE ACCOUNT] Step 9: deck_likes")
        cur.execute("DELETE FROM deck_likes WHERE user_id = %s::uuid", (uid,))
        print("[DELETE ACCOUNT] Step 10: nullify forked decks")
        cur.execute("UPDATE decks SET original_deck_id = NULL WHERE original_deck_id IN (SELECT deck_id FROM decks WHERE user_id = %s::uuid)", (uid,))
        print("[DELETE ACCOUNT] Step 11: review_logs")
        cur.execute("DELETE FROM review_logs WHERE card_id IN (SELECT card_id FROM cards WHERE deck_id IN (SELECT deck_id FROM decks WHERE user_id = %s::uuid))", (uid,))
        print("[DELETE ACCOUNT] Step 12: schedules")
        cur.execute("DELETE FROM schedules WHERE card_id IN (SELECT card_id FROM cards WHERE deck_id IN (SELECT deck_id FROM decks WHERE user_id = %s::uuid))", (uid,))
        print("[DELETE ACCOUNT] Step 13: cards")
        cur.execute("DELETE FROM cards WHERE deck_id IN (SELECT deck_id FROM decks WHERE user_id = %s::uuid)", (uid,))
        print("[DELETE ACCOUNT] Step 14: decks")
        cur.execute("DELETE FROM decks WHERE user_id = %s::uuid", (uid,))
        print("[DELETE ACCOUNT] Step 15: user")
        cur.execute("DELETE FROM users WHERE user_id = %s::uuid", (uid,))
        raw_conn.commit()
        print(f"[DELETE ACCOUNT] SUCCESS: user {uid} deleted")
    except Exception as e:
        raw_conn.rollback()
        err_str = tb.format_exc()
        print(f"[DELETE ACCOUNT] ERROR: {err_str}")
        raise HTTPException(status_code=500, detail=f"Failed to delete account: {str(e)}")
    finally:
        cur.close()
        raw_conn.close()

    return {"status": "success", "message": "User account and all associated data permanently deleted."}


from app.schemas.user_schema import PublicUserResponse
from app.models.all_models import Follow

@router.get("/users/search", response_model=list[PublicUserResponse])
def search_users(q: str, db: Session = Depends(get_db)):
    if not q or len(q) < 2:
        return []

    search_term = f"%{q}%"
    users = db.query(User).filter(
        (User.username.ilike(search_term)) |
        (User.full_name.ilike(search_term))
    ).limit(20).all()

    results = []
    for u in users:
        followers_count = db.query(Follow).filter(Follow.following_id == u.user_id).count()
        following_count = db.query(Follow).filter(Follow.follower_id == u.user_id).count()
        results.append({
            "user_id": u.user_id,
            "username": u.username,
            "full_name": u.full_name,
            "bio": u.bio,
            "profile_picture_url": u.profile_picture_url,
            "website_url": u.website_url,
            "location": u.location,
            "tags": u.tags,
            "role": u.role,
            "current_streak": u.current_streak,
            "followers_count": followers_count,
            "following_count": following_count
        })

    return results


@router.get("/users/{username}", response_model=PublicUserResponse)
def get_public_user_profile(username: str, db: Session = Depends(get_db)):
    # Remove @ if present
    if username.startswith("@"):
        username = username[1:]

    db_user = db.query(User).filter(User.username == username).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    followers_count = db.query(Follow).filter(Follow.following_id == db_user.user_id).count()
    following_count = db.query(Follow).filter(Follow.follower_id == db_user.user_id).count()

    response_data = {
        "user_id": db_user.user_id,
        "username": db_user.username,
        "full_name": db_user.full_name,
        "bio": db_user.bio,
        "profile_picture_url": db_user.profile_picture_url,
        "website_url": db_user.website_url,
        "location": db_user.location,
        "tags": db_user.tags,
        "role": db_user.role,
        "current_streak": db_user.current_streak,
        "followers_count": followers_count,
        "following_count": following_count
    }

    return response_data


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(request: UserEmailRequest, db: Session = Depends(get_db)):
    """Request password reset email."""
    db_user = db.query(User).filter(User.email == request.email).first()
    
    if not db_user:
        # Don't reveal if user exists or not for security
        return {"message": "If an account exists with this email, a password reset link has been sent."}
    
    try:
        reset_token = create_password_reset_token(db_user.email)
        send_password_reset_email(db_user.email, reset_token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending reset email: {str(e)}")
    
    return {"message": "If an account exists with this email, a password reset link has been sent."}


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password with token."""
    try:
        email = decode_password_reset_token(request.token)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link has expired.",
        )
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset link.",
        )
    
    db_user = db.query(User).filter(User.email == email).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters.",
        )
    
    db_user.password_hash = get_password_hash(request.new_password)
    db.commit()
    
    return {"message": "Password successfully reset. You can now log in."}
