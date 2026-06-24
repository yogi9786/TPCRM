"""
Lead management router — CRUD operations on Firestore 'leads' collection
Includes: activities, notes, WhatsApp message history, Meta form data
"""
from fastapi_cache.decorator import cache
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from models.lead import LeadCreate, LeadUpdate
from services.firebase_service import get_db
from auth import get_current_user
from typing import Optional

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("/", response_model=list[dict])
@cache(expire=30)
async def get_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    tag: Optional[str] = None,
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

    # Sort by createdAt descending
    leads.sort(key=lambda x: x.get("createdAt", ""), reverse=True)

    # Tag filter
    if tag:
        leads = [l for l in leads if tag in (l.get("tags") or [])]

    # Search filter
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
@cache(expire=30)
async def get_lead_stats(user: dict = Depends(get_current_user)):
    """Aggregate lead statistics for the authenticated user."""
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
        "fromMeta": sum(1 for l in leads if "meta" in (l.get("tags") or [])),
        "fromFacebook": sum(1 for l in leads if l.get("leadSource") == "Facebook Ads"),
        "fromInstagram": sum(1 for l in leads if l.get("leadSource") == "Instagram Ads"),
    }
    stats["conversionRate"] = round((stats["closed"] / stats["total"]) * 100) if stats["total"] > 0 else 0
    return stats


@router.get("/{lead_id}/activities")
@cache(expire=30)
async def get_lead_activities(lead_id: str, user: dict = Depends(get_current_user)):
    """Get full activity timeline for a lead (imports, status changes, messages, notes)."""
    db = get_db()
    doc = db.collection("leads").document(lead_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lead not found")

    activities_ref = db.collection("lead_activities").where("leadId", "==", lead_id)
    activities = [{"id": d.id, **d.to_dict()} for d in activities_ref.stream()]
    activities.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return activities


@router.post("/{lead_id}/notes")
async def add_lead_note(
    lead_id: str,
    note: str,
    user: dict = Depends(get_current_user)
):
    """Add a note/comment to a lead's activity timeline."""
    db = get_db()
    doc = db.collection("leads").document(lead_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lead not found")

    now = datetime.utcnow().isoformat()
    activity = {
        "leadId": lead_id,
        "type": "note",
        "title": "Note added",
        "description": note,
        "author": user.get("email", user["uid"]),
        "createdAt": now,
    }
    ref = db.collection("lead_activities").add(activity)
    db.collection("leads").document(lead_id).update({"updatedAt": now})
    return {"id": ref[1].id, **activity}


@router.get("/{lead_id}/messages")
@cache(expire=30)
async def get_lead_messages(lead_id: str, user: dict = Depends(get_current_user)):
    """Get WhatsApp message history for a lead by phone number."""
    db = get_db()
    doc = db.collection("leads").document(lead_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead_data = doc.to_dict()
    phone = lead_data.get("phone", "")
    messages = []

    if phone:
        msgs_to = db.collection("messages").where("to", "==", phone).stream()
        msgs_from = db.collection("messages").where("from", "==", phone).stream()
        messages = [{"id": d.id, **d.to_dict()} for d in msgs_to]
        messages += [{"id": d.id, **d.to_dict()} for d in msgs_from]
        messages.sort(key=lambda x: x.get("createdAt", ""), reverse=True)

    return messages


@router.get("/{lead_id}/meta-data")
@cache(expire=30)
async def get_lead_meta_data(lead_id: str, user: dict = Depends(get_current_user)):
    """Get the original Meta form field data for a lead."""
    db = get_db()
    doc = db.collection("leads").document(lead_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead_data = doc.to_dict()
    meta_lead_id = lead_data.get("metaLeadId")

    if not meta_lead_id:
        return {"hasMeta": False}

    meta_doc = db.collection("meta_leads").document(meta_lead_id).get()
    if not meta_doc.exists:
        return {"hasMeta": False}

    return {"hasMeta": True, **meta_doc.to_dict()}


@router.get("/{lead_id}", response_model=dict)
@cache(expire=30)
async def get_lead(lead_id: str, user: dict = Depends(get_current_user)):
    """Get a single lead by ID."""
    db = get_db()
    doc = db.collection("leads").document(lead_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lead not found")
    data = doc.to_dict()
    if data.get("userId") not in (user["uid"], "auto_imported"):
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"id": doc.id, **data}


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
    lead_id = doc_ref[1].id

    # Sync to meta_leads if source is Facebook/Instagram Ads
    if lead.leadSource in ("Facebook Ads", "Instagram Ads", "Meta Ads"):
        meta_doc = {
            "leadgenId": f"crm_manual_{lead_id}",
            "formId": "CRM Manual Entry",
            "formName": "CRM Manual Entry",
            "adId": "",
            "adName": "",
            "campaignId": "",
            "campaignName": "",
            "fieldData": {
                "full_name": lead.fullName,
                "email": lead.email or "",
                "phone_number": lead.phone or ""
            },
            "source": lead.leadSource,
            "importedToCRM": True,
            "crmLeadId": lead_id,
            "isManualCRM": True,
            "createdAt": now,
            "metaCreatedTime": now,
        }
        meta_ref = db.collection("meta_leads").add(meta_doc)
        db.collection("leads").document(lead_id).update({"metaLeadId": meta_ref[1].id})

    # Log creation activity
    db.collection("lead_activities").add({
        "leadId": lead_id,
        "type": "created",
        "title": "Lead created",
        "description": f"Lead '{lead.fullName}' created manually",
        "createdAt": now,
    })

    return {"id": lead_id, **lead_data}


@router.put("/{lead_id}", response_model=dict)
async def update_lead(lead_id: str, update: LeadUpdate, user: dict = Depends(get_current_user)):
    """Update an existing lead."""
    db = get_db()
    lead_ref = db.collection("leads").document(lead_id)
    doc = lead_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lead not found")
    if doc.to_dict().get("userId") not in (user["uid"], "auto_imported"):
        raise HTTPException(status_code=403, detail="Forbidden")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    now = datetime.utcnow().isoformat()
    update_data["updatedAt"] = now

    new_source = update_data.get("leadSource")
    if new_source in ("Facebook Ads", "Instagram Ads", "Meta Ads") and not doc.to_dict().get("metaLeadId"):
        meta_doc = {
            "leadgenId": f"crm_manual_{lead_id}",
            "formId": "CRM Manual Entry",
            "formName": "CRM Manual Entry",
            "adId": "",
            "adName": "",
            "campaignId": "",
            "campaignName": "",
            "fieldData": {
                "full_name": update_data.get("fullName", doc.to_dict().get("fullName", "")),
                "email": update_data.get("email", doc.to_dict().get("email", "")),
                "phone_number": update_data.get("phone", doc.to_dict().get("phone", ""))
            },
            "source": new_source,
            "importedToCRM": True,
            "crmLeadId": lead_id,
            "isManualCRM": True,
            "createdAt": now,
            "metaCreatedTime": now,
        }
        meta_ref = db.collection("meta_leads").add(meta_doc)
        update_data["metaLeadId"] = meta_ref[1].id

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
    if doc.to_dict().get("userId") not in (user["uid"], "auto_imported"):
        raise HTTPException(status_code=403, detail="Forbidden")
    lead_ref.delete()
    return None


@router.patch("/{lead_id}/status", response_model=dict)
async def update_lead_status(lead_id: str, status: str, user: dict = Depends(get_current_user)):
    """Quick status update with activity log."""
    db = get_db()
    lead_ref = db.collection("leads").document(lead_id)
    doc = lead_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Lead not found")

    old_status = doc.to_dict().get("status", "")
    now = datetime.utcnow().isoformat()
    lead_ref.update({"status": status, "updatedAt": now})

    # Log status change
    db.collection("lead_activities").add({
        "leadId": lead_id,
        "type": "status_change",
        "title": f"Status changed to {status}",
        "description": f"Status updated from '{old_status}' to '{status}'",
        "metadata": {"old_status": old_status, "new_status": status},
        "createdAt": now,
    })

    return {"id": lead_id, "status": status}
