# app/api/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.all_models import User
from app.core.security import SECRET_KEY, ALGORITHM

# This tells FastAPI to look for the Bearer token in the headers
token_auth_scheme = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(token_auth_scheme), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        # Decode the JWT to extract the user_id (the "sub" claim)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

    # Fetch the actual user from the DB
    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return user
