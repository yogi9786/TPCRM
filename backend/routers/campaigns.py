"""
Campaigns router — Create and manage broadcast campaigns
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime
from models.campaign import CampaignCreate, BroadcastRequest
from services.firebase_service import get_db
from services.twilio_service import send_bulk_messages
import logging

router = APIRouter(prefix="/campaigns", tags=["campaigns"])
logger = logging.getLogger(__name__)


@router.get("/")
async def get_campaigns(user_id: str):
    """Get all campaigns for a user."""
    db = get_db()
    docs = db.collection("campaigns").where("userId", "==", user_id).stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.post("/", status_code=201)
async def create_campaign(campaign: CampaignCreate):
    """Create a new broadcast campaign (draft)."""
    db = get_db()
    now = datetime.utcnow().isoformat()
    data = {
        **campaign.model_dump(),
        "targetCount": 0,
        "sentCount": 0,
        "deliveredCount": 0,
        "readCount": 0,
        "failedCount": 0,
        "status": "draft",
        "createdAt": now,
        "updatedAt": now,
    }
    ref = db.collection("campaigns").add(data)
    return {"id": ref[1].id, **data}


@router.post("/broadcast")
async def broadcast_campaign(req: BroadcastRequest):
    """
    Execute a broadcast campaign — send WhatsApp messages to all numbers.
    Updates campaign stats in Firestore.
    """
    db = get_db()
    
    # Update campaign to running
    campaign_ref = db.collection("campaigns").document(req.campaign_id)
    campaign_ref.update({
        "status": "running",
        "targetCount": len(req.phone_numbers),
        "updatedAt": datetime.utcnow().isoformat(),
    })
    
    # Send messages
    results = send_bulk_messages(req.phone_numbers, req.message)
    
    # Update campaign with results
    campaign_ref.update({
        "status": "completed",
        "sentCount": results["sent"],
        "failedCount": results["failed"],
        "completedAt": datetime.utcnow().isoformat(),
    })
    
    logger.info(f"Campaign {req.campaign_id} completed: {results['sent']} sent, {results['failed']} failed")
    return results


@router.get("/{campaign_id}/stats")
async def get_campaign_stats(campaign_id: str):
    """Get delivery statistics for a campaign."""
    db = get_db()
    doc = db.collection("campaigns").document(campaign_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Campaign not found")
    data = doc.to_dict()
    target = data.get("targetCount", 1)
    return {
        "id": campaign_id,
        **data,
        "deliveryRate": round((data.get("sentCount", 0) / max(target, 1)) * 100, 1),
        "failureRate": round((data.get("failedCount", 0) / max(target, 1)) * 100, 1),
    }
