"""
Clients router — Full client lifecycle management for agency use
Supports: Client profiles, contacts, services, payments, documents, meeting notes
"""
from fastapi_cache.decorator import cache
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List
from services.firebase_service import get_db
from auth import get_current_user

router = APIRouter(prefix="/clients", tags=["clients"])

# ── Models ────────────────────────────────────────────────────────────────────

class ContactPerson(BaseModel):
    name: str
    designation: str = ""
    email: str = ""
    phone: str = ""
    isPrimary: bool = False

class ServicePurchased(BaseModel):
    name: str
    description: str = ""
    amount: float = 0
    currency: str = "INR"
    billingCycle: str = "one-time"   # one-time | monthly | quarterly | annually
    startDate: str = ""
    endDate: str = ""
    status: str = "active"           # active | paused | cancelled | completed

class PaymentRecord(BaseModel):
    amount: float
    currency: str = "INR"
    date: str
    method: str = "bank_transfer"    # bank_transfer | upi | card | cash | cheque
    reference: str = ""
    notes: str = ""
    status: str = "paid"             # paid | pending | overdue | refunded

class MeetingNote(BaseModel):
    title: str
    date: str
    attendees: str = ""
    summary: str
    actionItems: str = ""
    nextMeetingDate: str = ""

class ClientDocument(BaseModel):
    name: str
    type: str = "contract"           # contract | invoice | proposal | nda | other
    url: str
    uploadedAt: str = ""
    notes: str = ""

class ClientCreate(BaseModel):
    # Basic profile
    companyName: str
    clientCode: str = ""             # e.g. CLI-001
    industry: str = ""
    website: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    country: str = "India"
    gstin: str = ""
    pan: str = ""
    # Source
    leadId: str = ""                 # Reference back to original lead
    convertedDate: str = ""
    accountManager: str = ""
    status: str = "active"          # active | inactive | churned | on-hold
    tier: str = "standard"          # standard | premium | enterprise
    notes: str = ""
    tags: List[str] = []
    # Embedded sub-documents (start with empty lists, add via sub-routes)
    contacts: List[dict] = []
    services: List[dict] = []
    payments: List[dict] = []
    documents: List[dict] = []
    meetingNotes: List[dict] = []

class ClientUpdate(BaseModel):
    companyName: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    accountManager: Optional[str] = None
    status: Optional[str] = None
    tier: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


# ── Helper ────────────────────────────────────────────────────────────────────

def _get_client_or_404(db, client_id: str, user_uid: str) -> dict:
    doc = db.collection("clients").document(client_id).get()
    if not doc.exists or doc.to_dict().get("userId") != user_uid:
        raise HTTPException(status_code=404, detail="Client not found")
    return doc


# ── Client CRUD ───────────────────────────────────────────────────────────────

@router.get("/")
@cache(expire=30)
async def list_clients(
    status: Optional[str] = None,
    tier: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """List all clients, optionally filtered."""
    db = get_db()
    ref = db.collection("clients").where("userId", "==", user["uid"])
    docs = ref.stream()
    clients = [{"id": d.id, **d.to_dict()} for d in docs]
    if status:
        clients = [c for c in clients if c.get("status") == status]
    if tier:
        clients = [c for c in clients if c.get("tier") == tier]
    clients.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return clients


@router.post("/", status_code=201)
async def create_client(client: ClientCreate, user: dict = Depends(get_current_user)):
    """Create a new client."""
    db = get_db()
    now = datetime.utcnow().isoformat()
    data = {
        **client.model_dump(),
        "userId": user["uid"],
        "createdAt": now,
        "updatedAt": now,
        "totalPaid": 0,
        "totalRevenue": 0,
    }
    ref = db.collection("clients").add(data)
    return {"success": True, "id": ref[1].id}


@router.get("/summary")
@cache(expire=30)
async def get_clients_summary(user: dict = Depends(get_current_user)):
    """Aggregate stats across all clients."""
    db = get_db()
    docs = db.collection("clients").where("userId", "==", user["uid"]).stream()
    clients = [d.to_dict() for d in docs]
    total_revenue = sum(
        sum(p.get("amount", 0) for p in c.get("payments", []) if p.get("status") == "paid")
        for c in clients
    )
    return {
        "total": len(clients),
        "active": sum(1 for c in clients if c.get("status") == "active"),
        "inactive": sum(1 for c in clients if c.get("status") == "inactive"),
        "churned": sum(1 for c in clients if c.get("status") == "churned"),
        "onHold": sum(1 for c in clients if c.get("status") == "on-hold"),
        "enterprise": sum(1 for c in clients if c.get("tier") == "enterprise"),
        "premium": sum(1 for c in clients if c.get("tier") == "premium"),
        "standard": sum(1 for c in clients if c.get("tier") == "standard"),
        "totalRevenue": total_revenue,
        "totalServices": sum(len(c.get("services", [])) for c in clients),
    }


@router.get("/{client_id}")
@cache(expire=30)
async def get_client(client_id: str, user: dict = Depends(get_current_user)):
    """Get a single client with all sub-documents."""
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    return {"id": doc.id, **doc.to_dict()}


@router.put("/{client_id}")
@router.patch("/{client_id}")
async def update_client(client_id: str, update: ClientUpdate, user: dict = Depends(get_current_user)):
    """Update client profile fields."""
    db = get_db()
    _get_client_or_404(db, client_id, user["uid"])
    data = {k: v for k, v in update.model_dump().items() if v is not None}
    data["updatedAt"] = datetime.utcnow().isoformat()
    db.collection("clients").document(client_id).update(data)
    return {"success": True}


@router.delete("/{client_id}")
async def delete_client(client_id: str, user: dict = Depends(get_current_user)):
    """Delete a client and all associated data."""
    db = get_db()
    _get_client_or_404(db, client_id, user["uid"])
    db.collection("clients").document(client_id).delete()
    return {"success": True}


# ── Contacts ──────────────────────────────────────────────────────────────────

@router.post("/{client_id}/contacts")
async def add_contact(client_id: str, contact: ContactPerson, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    contacts = data.get("contacts", [])
    new_contact = {**contact.model_dump(), "id": datetime.utcnow().timestamp()}
    contacts.append(new_contact)
    db.collection("clients").document(client_id).update({"contacts": contacts, "updatedAt": datetime.utcnow().isoformat()})
    return {"success": True, "contacts": contacts}


@router.put("/{client_id}/contacts/{contact_idx}")
async def update_contact(client_id: str, contact_idx: int, contact: ContactPerson, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    contacts = data.get("contacts", [])
    if contact_idx < 0 or contact_idx >= len(contacts):
        raise HTTPException(status_code=404, detail="Contact not found")
    
    original_id = contacts[contact_idx].get("id")
    updated_contact = {**contact.model_dump(), "id": original_id}
    contacts[contact_idx] = updated_contact
    
    db.collection("clients").document(client_id).update({"contacts": contacts, "updatedAt": datetime.utcnow().isoformat()})
    return {"success": True, "contacts": contacts}


@router.delete("/{client_id}/contacts/{contact_idx}")
async def remove_contact(client_id: str, contact_idx: int, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    contacts = data.get("contacts", [])
    if contact_idx < 0 or contact_idx >= len(contacts):
        raise HTTPException(status_code=404, detail="Contact not found")
    contacts.pop(contact_idx)
    db.collection("clients").document(client_id).update({"contacts": contacts, "updatedAt": datetime.utcnow().isoformat()})
    return {"success": True}


# ── Services ──────────────────────────────────────────────────────────────────

@router.post("/{client_id}/services")
async def add_service(client_id: str, service: ServicePurchased, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    services = data.get("services", [])
    new_service = {**service.model_dump(), "id": datetime.utcnow().timestamp(), "addedAt": datetime.utcnow().isoformat()}
    services.append(new_service)
    total = sum(s.get("amount", 0) for s in services)
    db.collection("clients").document(client_id).update({
        "services": services, "totalRevenue": total, "updatedAt": datetime.utcnow().isoformat()
    })
    return {"success": True}


@router.put("/{client_id}/services/{service_idx}")
async def update_service(client_id: str, service_idx: int, service: ServicePurchased, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    services = data.get("services", [])
    if service_idx < 0 or service_idx >= len(services):
        raise HTTPException(status_code=404, detail="Service not found")
    
    original_id = services[service_idx].get("id")
    original_added = services[service_idx].get("addedAt", datetime.utcnow().isoformat())
    updated_service = {**service.model_dump(), "id": original_id, "addedAt": original_added}
    services[service_idx] = updated_service
    
    total = sum(s.get("amount", 0) for s in services)
    db.collection("clients").document(client_id).update({
        "services": services, "totalRevenue": total, "updatedAt": datetime.utcnow().isoformat()
    })
    return {"success": True}


@router.delete("/{client_id}/services/{service_idx}")
async def remove_service(client_id: str, service_idx: int, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    services = data.get("services", [])
    if service_idx < 0 or service_idx >= len(services):
        raise HTTPException(status_code=404, detail="Service not found")
    services.pop(service_idx)
    total = sum(s.get("amount", 0) for s in services)
    db.collection("clients").document(client_id).update({
        "services": services, "totalRevenue": total, "updatedAt": datetime.utcnow().isoformat()
    })
    return {"success": True}


# ── Payments ──────────────────────────────────────────────────────────────────

@router.post("/{client_id}/payments")
async def add_payment(client_id: str, payment: PaymentRecord, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    payments = data.get("payments", [])
    new_payment = {**payment.model_dump(), "id": datetime.utcnow().timestamp(), "recordedAt": datetime.utcnow().isoformat()}
    payments.append(new_payment)
    total_paid = sum(p.get("amount", 0) for p in payments if p.get("status") == "paid")
    db.collection("clients").document(client_id).update({
        "payments": payments, "totalPaid": total_paid, "updatedAt": datetime.utcnow().isoformat()
    })
    return {"success": True}


@router.put("/{client_id}/payments/{payment_idx}")
async def update_payment(client_id: str, payment_idx: int, payment: PaymentRecord, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    payments = data.get("payments", [])
    if payment_idx < 0 or payment_idx >= len(payments):
        raise HTTPException(status_code=404, detail="Payment not found")
    
    original_id = payments[payment_idx].get("id")
    original_recorded = payments[payment_idx].get("recordedAt", datetime.utcnow().isoformat())
    updated_payment = {**payment.model_dump(), "id": original_id, "recordedAt": original_recorded}
    payments[payment_idx] = updated_payment
    
    total_paid = sum(p.get("amount", 0) for p in payments if p.get("status") == "paid")
    db.collection("clients").document(client_id).update({
        "payments": payments, "totalPaid": total_paid, "updatedAt": datetime.utcnow().isoformat()
    })
    return {"success": True}


@router.delete("/{client_id}/payments/{payment_idx}")
async def remove_payment(client_id: str, payment_idx: int, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    payments = data.get("payments", [])
    if payment_idx < 0 or payment_idx >= len(payments):
        raise HTTPException(status_code=404, detail="Payment not found")
    payments.pop(payment_idx)
    total_paid = sum(p.get("amount", 0) for p in payments if p.get("status") == "paid")
    db.collection("clients").document(client_id).update({
        "payments": payments, "totalPaid": total_paid, "updatedAt": datetime.utcnow().isoformat()
    })
    return {"success": True}


# ── Meeting Notes ─────────────────────────────────────────────────────────────

@router.post("/{client_id}/meetings")
async def add_meeting(client_id: str, meeting: MeetingNote, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    meetings = data.get("meetingNotes", [])
    new_meeting = {**meeting.model_dump(), "id": datetime.utcnow().timestamp(), "createdAt": datetime.utcnow().isoformat()}
    meetings.append(new_meeting)
    meetings.sort(key=lambda x: x.get("date", ""), reverse=True)
    db.collection("clients").document(client_id).update({
        "meetingNotes": meetings, "updatedAt": datetime.utcnow().isoformat()
    })
    return {"success": True}


@router.put("/{client_id}/meetings/{meeting_idx}")
async def update_meeting(client_id: str, meeting_idx: int, meeting: MeetingNote, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    meetings = data.get("meetingNotes", [])
    if meeting_idx < 0 or meeting_idx >= len(meetings):
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    original_id = meetings[meeting_idx].get("id")
    original_created = meetings[meeting_idx].get("createdAt", datetime.utcnow().isoformat())
    updated_meeting = {**meeting.model_dump(), "id": original_id, "createdAt": original_created}
    meetings[meeting_idx] = updated_meeting
    meetings.sort(key=lambda x: x.get("date", ""), reverse=True)
    
    db.collection("clients").document(client_id).update({
        "meetingNotes": meetings, "updatedAt": datetime.utcnow().isoformat()
    })
    return {"success": True}


@router.delete("/{client_id}/meetings/{meeting_idx}")
async def remove_meeting(client_id: str, meeting_idx: int, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    meetings = data.get("meetingNotes", [])
    if meeting_idx < 0 or meeting_idx >= len(meetings):
        raise HTTPException(status_code=404, detail="Meeting not found")
    meetings.pop(meeting_idx)
    db.collection("clients").document(client_id).update({
        "meetingNotes": meetings, "updatedAt": datetime.utcnow().isoformat()
    })
    return {"success": True}


# ── Documents ─────────────────────────────────────────────────────────────────

@router.post("/{client_id}/documents")
async def add_document(client_id: str, document: ClientDocument, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    documents = data.get("documents", [])
    new_doc = {**document.model_dump(), "id": datetime.utcnow().timestamp(), "uploadedAt": datetime.utcnow().isoformat()}
    documents.append(new_doc)
    db.collection("clients").document(client_id).update({
        "documents": documents, "updatedAt": datetime.utcnow().isoformat()
    })
    return {"success": True}


@router.put("/{client_id}/documents/{doc_idx}")
async def update_document(client_id: str, doc_idx: int, document: ClientDocument, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    documents = data.get("documents", [])
    if doc_idx < 0 or doc_idx >= len(documents):
        raise HTTPException(status_code=404, detail="Document not found")
        
    original_id = documents[doc_idx].get("id")
    original_uploaded = documents[doc_idx].get("uploadedAt", datetime.utcnow().isoformat())
    updated_doc = {**document.model_dump(), "id": original_id, "uploadedAt": original_uploaded}
    documents[doc_idx] = updated_doc
    
    db.collection("clients").document(client_id).update({
        "documents": documents, "updatedAt": datetime.utcnow().isoformat()
    })
    return {"success": True}


@router.delete("/{client_id}/documents/{doc_idx}")
async def remove_document(client_id: str, doc_idx: int, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = _get_client_or_404(db, client_id, user["uid"])
    data = doc.to_dict()
    documents = data.get("documents", [])
    if doc_idx < 0 or doc_idx >= len(documents):
        raise HTTPException(status_code=404, detail="Document not found")
    documents.pop(doc_idx)
    db.collection("clients").document(client_id).update({
        "documents": documents, "updatedAt": datetime.utcnow().isoformat()
    })
    return {"success": True}
