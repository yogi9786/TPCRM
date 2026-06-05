from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class AutomationCreate(BaseModel):
    name: str
    trigger: str
    triggerConfig: Optional[Dict[str, Any]] = {}
    actions: List[Dict[str, Any]] = []
    isActive: bool = True

class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    trigger: Optional[str] = None
    triggerConfig: Optional[Dict[str, Any]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    isActive: Optional[bool] = None
