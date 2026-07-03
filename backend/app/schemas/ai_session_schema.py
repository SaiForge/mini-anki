from pydantic import BaseModel, ConfigDict
from typing import Optional, Any, Dict
from datetime import datetime
from uuid import UUID

class AISessionBase(BaseModel):
    mode: str
    title: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class AISessionCreate(AISessionBase):
    pass

class AISessionUpdate(BaseModel):
    title: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

class AISessionResponse(AISessionBase):
    session_id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
