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
    # Check if user already exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Hash password and create user
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email, 
        password_hash=hashed_password, 
        username=user.username,
        full_name=user.full_name,
        bio=user.bio,
        profile_picture_url=user.profile_picture_url,
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


@router.get("/me", response_model=UserResponse)
def get_user_profile(current_user: User = Depends(get_current_user)):
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

    db.commit()
    db.refresh(current_user)
    return current_user


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
