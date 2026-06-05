"""
Pydantic models for Content Planner
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ContentPlanCreate(BaseModel):
    title: str
    body: str
    platform: str = "whatsapp"         # whatsapp | email | meta | instagram | sms
    contentType: str = "post"           # post | story | reel | email | whatsapp | sms
    status: str = "draft"               # draft | scheduled | published | archived
    scheduledAt: Optional[str] = None   # ISO date string
    tags: Optional[List[str]] = []
    imageUrl: Optional[str] = None
    targetAudience: Optional[str] = "All"
    campaignId: Optional[str] = None
    notes: Optional[str] = None


class ContentPlanUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    platform: Optional[str] = None
    contentType: Optional[str] = None
    status: Optional[str] = None
    scheduledAt: Optional[str] = None
    tags: Optional[List[str]] = None
    imageUrl: Optional[str] = None
    targetAudience: Optional[str] = None
    campaignId: Optional[str] = None
    notes: Optional[str] = None
