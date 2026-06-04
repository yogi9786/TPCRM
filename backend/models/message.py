from pydantic import BaseModel
from typing import Optional
from enum import Enum


class MessageDirection(str, Enum):
    outbound = "outbound"
    inbound = "inbound"


class MessageStatus(str, Enum):
    queued = "queued"
    sent = "sent"
    delivered = "delivered"
    read = "read"
    failed = "failed"


class SendMessageRequest(BaseModel):
    to: str  
    body: str
    lead_id: Optional[str] = None


class MessageResponse(BaseModel):
    id: str
    leadId: str
    phone: str
    direction: str
    body: str
    status: str
    twilioSid: Optional[str] = None
    createdAt: str
