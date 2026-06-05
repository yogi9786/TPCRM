from pydantic import BaseModel
from typing import Optional

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    dueDate: Optional[str] = None
    priority: str = "Medium" # Low, Medium, High
    status: str = "Pending" # Pending, In Progress, Completed
    relatedTo: Optional[str] = None # e.g. Lead ID or Deal ID

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    dueDate: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    relatedTo: Optional[str] = None
