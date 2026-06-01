"""
Lead management router — CRUD operations on Firestore 'leads' collection
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from datetime import datetime
from models.lead import LeadCreate, LeadUpdate, LeadResponse
from services.firebase_service import get_db, verify_firebase_token
from typing import Optional
from fastapi_cache.decorator import cache
from fastapi import Request, Response

def user_cache_key_builder(func, namespace: str = "", request: Request = None, response: Response = None, *args, **kwargs):
    user = kwargs.get("user")
    uid = user["uid"] if user else "anonymous"
    return f"{namespace}:{func.__module__}:{func.__name__}:{uid}"

router = APIRouter(prefix="/leads", tags=["leads"])


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Extract and verify Firebase token from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization token")
    token = authorization.split(" ", 1)[1]
    try:
        return verify_firebase_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


@router.get("/", response_model=list[dict])
@cache(expire=60, key_builder=user_cache_key_builder)
async def get_leads(user: dict = Depends(get_current_user)):
    """Get all leads for the authenticated user."""
    db = get_db()
    leads_ref = db.collection("leads").where("userId", "==", user["uid"])
    docs = leads_ref.stream()
    return [{"id": doc.id, **doc.to_dict()} for doc in docs]


@router.post("/", response_model=dict, status_code=201)
async def create_lead(lead: LeadCreate, user: dict = Depends(get_current_user)):
    """Create a new lead. userId is always taken from the auth token."""
    db = get_db()
    now = datetime.utcnow().isoformat()
    lead_data = {
        **lead.model_dump(),
        "userId": user["uid"],   # always overwrite with verified user
        "createdAt": now,
        "updatedAt": now,
    }
    doc_ref = db.collection("leads").add(lead_data)
    return {"id": doc_ref[1].id, **lead_data}



@router.put("/{lead_id}", response_model=dict)
async def update_lead(lead_id: str, update: LeadUpdate, user: dict = Depends(get_current_user)):
    """Update an existing lead."""
    db = get_db()
    lead_ref = db.collection("leads").document(lead_id)
    doc = lead_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lead not found")
    if doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()
    lead_ref.update(update_data)
    return {"id": lead_id, **doc.to_dict(), **update_data}


@router.delete("/{lead_id}", status_code=204)
async def delete_lead(lead_id: str, user: dict = Depends(get_current_user)):
    """Delete a lead."""
    db = get_db()
    lead_ref = db.collection("leads").document(lead_id)
    doc = lead_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lead not found")
    if doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    lead_ref.delete()
    return None


@router.patch("/{lead_id}/status", response_model=dict)
async def update_lead_status(lead_id: str, status: str, user: dict = Depends(get_current_user)):
    """Quick status update."""
    db = get_db()
    lead_ref = db.collection("leads").document(lead_id)
    lead_ref.update({"status": status, "updatedAt": datetime.utcnow().isoformat()})
    return {"id": lead_id, "status": status}
