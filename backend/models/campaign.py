from pydantic import BaseModel
from typing import Optional
from enum import Enum


class CampaignStatus(str, Enum):
    draft = "draft"
    scheduled = "scheduled"
    running = "running"
    completed = "completed"
    failed = "failed"
    paused = "paused"


class CampaignType(str, Enum):
    whatsapp_broadcast = "whatsapp_broadcast"
    meta_retarget = "meta_retarget"
    email_blast = "email_blast"


class CampaignCreate(BaseModel):
    name: str
    message: str
    targetStatus: Optional[str] = "All"
    targetSource: Optional[str] = "All"   # All, Facebook Ads, Instagram Ads, WhatsApp, etc.
    campaignType: Optional[str] = "whatsapp_broadcast"
    templateName: Optional[str] = "Custom"
    scheduledAt: Optional[str] = None     # ISO datetime string for auto-send
    metaCampaignId: Optional[str] = None  # Link to Meta Ad Campaign


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    message: Optional[str] = None
    status: Optional[str] = None
    targetStatus: Optional[str] = None
    targetSource: Optional[str] = None
    campaignType: Optional[str] = None
    scheduledAt: Optional[str] = None
    metaCampaignId: Optional[str] = None


class BroadcastRequest(BaseModel):
    campaign_id: str
    message: str
    phone_numbers: list[str]


class CampaignResponse(BaseModel):
    id: str
    name: str
    message: str
    campaignType: str
    templateName: str
    targetCount: int
    sentCount: int
    deliveredCount: int
    readCount: int
    failedCount: int
    status: str
    userId: str
    createdAt: str
    scheduledAt: Optional[str] = None
