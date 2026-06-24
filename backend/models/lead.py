from pydantic import BaseModel
from typing import Optional
from enum import Enum


class LeadStatus(str, Enum):
    New = "New"
    Contacted = "Contacted"
    Qualified = "Qualified"
    Closed = "Closed"
    Lost = "Lost"


class LeadSource(str, Enum):
    FacebookAds  = "Facebook Ads"
    InstagramAds = "Instagram Ads"
    MetaAds      = "Meta Ads"
    WhatsApp     = "WhatsApp"
    Website      = "Website"
    Referral     = "Referral"
    WalkIn       = "Walk-in"
    Other        = "Other"


class LeadCreate(BaseModel):
    fullName: str
    email: Optional[str] = ""
    phone: str
    companyName: Optional[str] = ""
    leadSource: LeadSource = LeadSource.Other
    serviceInterested: Optional[str] = ""
    status: LeadStatus = LeadStatus.New
    notes: Optional[str] = ""
    userId: Optional[str] = None   
    tags: Optional[list[str]] = []
    value: Optional[float] = None
    whatsappOptIn: Optional[bool] = True


class LeadUpdate(BaseModel):
    fullName: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    companyName: Optional[str] = None
    leadSource: Optional[LeadSource] = None
    serviceInterested: Optional[str] = None
    status: Optional[LeadStatus] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    value: Optional[float] = None
    whatsappOptIn: Optional[bool] = None


class LeadResponse(BaseModel):
    id: str
    fullName: str
    email: str
    phone: str
    companyName: str
    leadSource: str
    serviceInterested: str
    status: str
    notes: str
    userId: str
    createdAt: str
    updatedAt: str
