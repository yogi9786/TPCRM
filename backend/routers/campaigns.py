"""
Campaigns router — Create and manage broadcast campaigns
Supports: WhatsApp broadcasts, Meta retargeting, scheduling, per-campaign analytics
"""
from fastapi_cache.decorator import cache
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from models.campaign import CampaignCreate, CampaignUpdate, BroadcastRequest
from services.firebase_service import get_db
from services.twilio_service import send_bulk_messages
from services.email_service import send_email
from auth import get_current_user
from typing import Optional
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("/")
@cache(expire=30)
async def get_campaigns(
    status: Optional[str] = None,
    campaign_type: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Get all campaigns for a user, optionally filtered by status or type."""
    db = get_db()
    ref = db.collection("campaigns").where("userId", "==", user["uid"])

    if status:
        ref = ref.where("status", "==", status)
    if campaign_type:
        ref = ref.where("campaignType", "==", campaign_type)

    docs = ref.stream()
    campaigns = [{"id": d.id, **d.to_dict()} for d in docs]
    campaigns.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return campaigns[:50]


@router.post("/", status_code=201)
async def create_campaign(campaign: CampaignCreate, user: dict = Depends(get_current_user)):
    """Create a new broadcast campaign (draft or scheduled)."""
    db = get_db()
    now = datetime.utcnow().isoformat()

    # Determine initial status
    status = "scheduled" if campaign.scheduledAt else "draft"

    data = {
        **campaign.model_dump(),
        "userId": user["uid"],
        "targetCount": 0,
        "sentCount": 0,
        "deliveredCount": 0,
        "readCount": 0,
        "failedCount": 0,
        "status": status,
        "createdAt": now,
        "updatedAt": now,
    }
    ref = db.collection("campaigns").add(data)
    return {"success": True, "id": ref[1].id, "status": status}


@router.get("/{campaign_id}")
@cache(expire=30)
async def get_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    """Get a single campaign by ID."""
    db = get_db()
    doc = db.collection("campaigns").document(campaign_id).get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"id": doc.id, **doc.to_dict()}


@router.put("/{campaign_id}")
@router.patch("/{campaign_id}")
async def update_campaign(campaign_id: str, update: CampaignUpdate, user: dict = Depends(get_current_user)):
    """Update campaign fields."""
    db = get_db()
    doc_ref = db.collection("campaigns").document(campaign_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Campaign not found")

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()

    # Auto-set status to 'scheduled' when scheduledAt is provided
    if "scheduledAt" in update_data and update_data["scheduledAt"]:
        if doc.to_dict().get("status") == "draft":
            update_data["status"] = "scheduled"

    doc_ref.update(update_data)
    return {"success": True}


@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    """Delete a campaign."""
    db = get_db()
    doc_ref = db.collection("campaigns").document(campaign_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Campaign not found")
    doc_ref.delete()
    return {"success": True}


@router.post("/{campaign_id}/schedule")
async def schedule_campaign(
    campaign_id: str,
    scheduled_at: str,
    user: dict = Depends(get_current_user)
):
    """Set a future send time for a campaign (auto-schedules it)."""
    db = get_db()
    doc_ref = db.collection("campaigns").document(campaign_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Campaign not found")

    doc_ref.update({
        "scheduledAt": scheduled_at,
        "status": "scheduled",
        "updatedAt": datetime.utcnow().isoformat(),
    })
    return {"success": True, "scheduledAt": scheduled_at}


@router.post("/{campaign_id}/launch")
async def launch_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    """
    Execute a broadcast campaign — send WhatsApp messages to target leads.
    Supports filtering by status AND source (e.g., only Facebook Ads leads).
    """
    db = get_db()

    doc_ref = db.collection("campaigns").document(campaign_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign = doc.to_dict()

    # Build leads query
    leads_ref = db.collection("leads").where("userId", "==", user["uid"])
    target_status = campaign.get("targetStatus", "All")
    target_source = campaign.get("targetSource", "All")

    if target_status and target_status != "All":
        leads_ref = leads_ref.where(filter=FieldFilter("status", "==", target_status))
    if target_source and target_source != "All":
        leads_ref = leads_ref.where(filter=FieldFilter("leadSource", "==", target_source))

    leads = [{"id": d.id, **d.to_dict()} for d in leads_ref.stream()]
    if not leads:
        raise HTTPException(status_code=400, detail="No leads match the target criteria")

    # Update to running
    doc_ref.update({
        "status": "running",
        "targetCount": len(leads),
        "startedAt": datetime.utcnow().isoformat(),
    })

    campaign_type = campaign.get("campaignType", "whatsapp_broadcast")
    message = campaign.get("message", "")
    attachment_url = campaign.get("attachmentUrl")
    attachment_name = campaign.get("attachmentName")

    results = {"sent": 0, "failed": 0}
    emails_processed = []

    if campaign_type == "email_blast":
        valid_leads = [lead for lead in leads if lead.get("email")]
        for lead in valid_leads:
            email = lead.get("email")
            name = lead.get("full_name") or lead.get("name") or "User"
            res = send_email(
                to_email=email,
                to_name=name,
                subject=campaign.get("name", "Update from TekhPortal"),
                html_content=f"<p>{message.replace(chr(10), '<br>')}</p>",
                text_content=message,
                attachment_url=attachment_url,
                attachment_name=attachment_name
            )
            if res.get("success"):
                results["sent"] += 1
            else:
                results["failed"] += 1
            emails_processed.append(email)
    else:
        # Collect phone numbers for WhatsApp
        phone_numbers = [lead.get("phone") for lead in leads if lead.get("phone")]
        results = send_bulk_messages(phone_numbers, message, media_url=attachment_url)

    # Update final stats
    doc_ref.update({
        "status": "completed",
        "sentCount": results["sent"],
        "failedCount": results["failed"],
        "completedAt": datetime.utcnow().isoformat(),
    })

    # Log activity for each lead
    now = datetime.utcnow().isoformat()
    for lead in leads:
        if campaign_type == "email_blast":
            email = lead.get("email", "")
            if email and email in emails_processed:
                db.collection("lead_activities").add({
                    "leadId": lead["id"],
                    "type": "email_sent",
                    "title": f"Email Campaign '{campaign.get('name', '')}' sent",
                    "description": f"Email sent via campaign '{campaign.get('name', '')}'",
                    "metadata": {"campaignId": campaign_id, "email": email},
                    "createdAt": now,
                })
        else:
            phone = lead.get("phone", "")
            if phone and phone in phone_numbers:
                db.collection("lead_activities").add({
                    "leadId": lead["id"],
                    "type": "campaign_sent",
                    "title": f"Campaign '{campaign.get('name', '')}' sent",
                    "description": f"WhatsApp message sent via campaign '{campaign.get('name', '')}'",
                    "metadata": {"campaignId": campaign_id, "phone": phone},
                    "createdAt": now,
                })

    return {
        "success": True,
        "targetCount": len(leads),
        "sentCount": results["sent"],
        "failedCount": results["failed"],
    }


@router.get("/{campaign_id}/stats")
@cache(expire=30)
async def get_campaign_stats(campaign_id: str, user: dict = Depends(get_current_user)):
    """Get delivery statistics for a campaign."""
    db = get_db()
    doc = db.collection("campaigns").document(campaign_id).get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Campaign not found")

    data = doc.to_dict()
    target = max(data.get("targetCount", 1), 1)
    sent = data.get("sentCount", 0)
    delivered = data.get("deliveredCount", 0)
    read = data.get("readCount", 0)
    failed = data.get("failedCount", 0)

    return {
        "id": campaign_id,
        **data,
        "deliveryRate": round((sent / target) * 100, 1),
        "readRate": round((read / max(sent, 1)) * 100, 1),
        "failureRate": round((failed / target) * 100, 1),
        "openRate": round((read / max(delivered, 1)) * 100, 1),
    }


@router.get("/summary/all")
@cache(expire=30)
async def get_campaigns_summary(user: dict = Depends(get_current_user)):
    """Get aggregate summary stats across all campaigns."""
    db = get_db()
    docs = db.collection("campaigns").where("userId", "==", user["uid"]).stream()
    campaigns = [d.to_dict() for d in docs]

    return {
        "total": len(campaigns),
        "draft": sum(1 for c in campaigns if c.get("status") == "draft"),
        "scheduled": sum(1 for c in campaigns if c.get("status") == "scheduled"),
        "running": sum(1 for c in campaigns if c.get("status") == "running"),
        "completed": sum(1 for c in campaigns if c.get("status") == "completed"),
        "totalSent": sum(c.get("sentCount", 0) for c in campaigns),
        "totalDelivered": sum(c.get("deliveredCount", 0) for c in campaigns),
        "totalFailed": sum(c.get("failedCount", 0) for c in campaigns),
        "whatsappBroadcasts": sum(1 for c in campaigns if c.get("campaignType") == "whatsapp_broadcast"),
        "metaRetargets": sum(1 for c in campaigns if c.get("campaignType") == "meta_retarget"),
    }
