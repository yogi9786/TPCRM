from pydantic import BaseModel
from typing import Optional

class DocumentCreate(BaseModel):
    title: str
    type: str = "Proposal" # Proposal, Invoice, Contract, Other
    fileUrl: str
    relatedTo: Optional[str] = None # e.g. Lead ID, Deal ID

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    fileUrl: Optional[str] = None
    relatedTo: Optional[str] = None
