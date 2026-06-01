# app/api/auth_router.py
import boto3
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.all_models import User
from app.schemas.user_schema import UserCreate, UserResponse, Token, MessageResponse
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_email_verification_token,
    decode_email_verification_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.api.deps import get_current_user
from datetime import timedelta
from jose import JWTError, ExpiredSignatureError

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

AWS_REGION = "us-east-2"
SES_SENDER_EMAIL = "miniankiapp@gmail.com"
FRONTEND_BASE_URL = "https://minianki.netlify.app"

ses_client = boto3.client("ses", region_name=AWS_REGION)


def send_verification_email(email: str, token: str) -> None:
    if not SES_SENDER_EMAIL:
        raise RuntimeError("SES_SENDER_EMAIL is not configured")

    verify_url = f"{FRONTEND_BASE_URL.rstrip('/')}/verify?token={token}"

    ses_client.send_email(
        Source=SES_SENDER_EMAIL,
        Destination={
            "ToAddresses": [email],
        },
        Message={
            "Subject": {"Data": "Verify your Mini Anki account"},
            "Body": {
                "Text": {
                    "Data": (
                        "Welcome to Mini Anki! "
                        f"Click here to verify your account: {verify_url}"
                    )
                }
            },
        },
    )


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
    new_user = User(email=user.email, password_hash=hashed_password, is_verified=False)

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

    try:
        verification_token = create_email_verification_token(new_user.email)
        send_verification_email(new_user.email, verification_token)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to send verification email. Try again later.",
        ) from exc

    return {"message": "User created. Please check your email to verify."}


@router.post("/login", response_model=Token)
def login_user(user: UserCreate, db: Session = Depends(get_db)):
    # Find user
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    if not db_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Check your inbox.",
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


@router.get("/verify", response_model=MessageResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    try:
        email = decode_email_verification_token(token)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification link has expired.",
        )
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification link.",
        )

    db_user = db.query(User).filter(User.email == email).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if db_user.is_verified:
        return {"message": "Email already verified. You can log in."}

    db_user.is_verified = True
    db.commit()

    return {"message": "Email successfully verified! You can now log in."}
