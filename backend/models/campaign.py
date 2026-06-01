from pydantic import BaseModel
from typing import Optional
from enum import Enum


class CampaignStatus(str, Enum):
    draft = "draft"
    running = "running"
    completed = "completed"
    failed = "failed"


class CampaignCreate(BaseModel):
    name: str
    message: str
    templateName: Optional[str] = "Custom"
    userId: str


class BroadcastRequest(BaseModel):
    campaign_id: str
    message: str
    phone_numbers: list[str]


class CampaignResponse(BaseModel):
    id: str
    name: str
    message: str
    templateName: str
    targetCount: int
    sentCount: int
    deliveredCount: int
    readCount: int
    failedCount: int
    status: str
    userId: str
    createdAt: str
