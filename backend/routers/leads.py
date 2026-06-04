"""
Lead management router — CRUD operations on Firestore 'leads' collection
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from datetime import datetime
from models.lead import LeadCreate, LeadUpdate, LeadResponse
from services.firebase_service import get_db
from auth import get_current_user
from typing import Optional

router = APIRouter(prefix="/leads", tags=["leads"])





@router.get("/", response_model=list[dict])
async def get_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    user: dict = Depends(get_current_user)
):
    """Get all leads for the authenticated user."""
    db = get_db()
    leads_ref = db.collection("leads").where("userId", "==", user["uid"])
    
    if status and status != 'All':
        leads_ref = leads_ref.where("status", "==", status)
    if source:
        leads_ref = leads_ref.where("leadSource", "==", source)
        
    docs = leads_ref.stream()
    leads = [{"id": doc.id, **doc.to_dict()} for doc in docs]
    
    
    leads.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    
    
    if search:
        q = search.lower()
        leads = [
            l for l in leads if q in l.get("fullName", "").lower() or 
            q in l.get("email", "").lower() or 
            q in l.get("phone", "") or 
            q in l.get("companyName", "").lower()
        ]
        
    return leads[:limit]


@router.get("/stats")
async def get_lead_stats(user: dict = Depends(get_current_user)):
    db = get_db()
    leads_ref = db.collection("leads").where("userId", "==", user["uid"])
    docs = leads_ref.stream()
    leads = [doc.to_dict() for doc in docs]
    
    stats = {
        "total": len(leads),
        "new": sum(1 for l in leads if l.get("status") == "New"),
        "contacted": sum(1 for l in leads if l.get("status") == "Contacted"),
        "qualified": sum(1 for l in leads if l.get("status") == "Qualified"),
        "closed": sum(1 for l in leads if l.get("status") == "Closed"),
        "lost": sum(1 for l in leads if l.get("status") == "Lost"),
    }
    stats["conversionRate"] = round((stats["closed"] / stats["total"]) * 100) if stats["total"] > 0 else 0
    return stats


@router.get("/{lead_id}", response_model=dict)
async def get_lead(lead_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.collection("leads").document(lead_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lead not found")
    if doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"id": doc.id, **doc.to_dict()}


@router.post("/", response_model=dict, status_code=201)
async def create_lead(lead: LeadCreate, user: dict = Depends(get_current_user)):
    """Create a new lead. userId is always taken from the auth token."""
    db = get_db()
    now = datetime.utcnow().isoformat()
    lead_data = {
        **lead.model_dump(),
        "userId": user["uid"],   
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
