from pydantic import BaseModel
from typing import Optional

class DealCreate(BaseModel):
    title: str
    value: float
    stage: str = "Lead" # Lead, Contacted, Proposal, Won, Lost
    expectedCloseDate: Optional[str] = None
    contactId: Optional[str] = None
    notes: Optional[str] = None

class DealUpdate(BaseModel):
    title: Optional[str] = None
    value: Optional[float] = None
    stage: Optional[str] = None
    expectedCloseDate: Optional[str] = None
    contactId: Optional[str] = None
    notes: Optional[str] = None
