"""
Campaigns router — Create and manage broadcast campaigns
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from models.campaign import CampaignCreate, CampaignUpdate, BroadcastRequest
from services.firebase_service import get_db
from services.twilio_service import send_bulk_messages
from auth import get_current_user

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("/")
async def get_campaigns(user: dict = Depends(get_current_user)):
    """Get all campaigns for a user."""
    db = get_db()
    docs = db.collection("campaigns").where("userId", "==", user["uid"]).stream()
    campaigns = [{"id": d.id, **d.to_dict()} for d in docs]
    campaigns.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return campaigns[:50]


@router.post("/", status_code=201)
async def create_campaign(campaign: CampaignCreate, user: dict = Depends(get_current_user)):
    """Create a new broadcast campaign (draft)."""
    db = get_db()
    now = datetime.utcnow().isoformat()
    data = {
        **campaign.model_dump(),
        "userId": user["uid"],
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
    return {"success": True, "id": ref[1].id}

@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc = db.collection("campaigns").document(campaign_id).get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"id": doc.id, **doc.to_dict()}


@router.patch("/{campaign_id}")
async def update_campaign(campaign_id: str, update: CampaignUpdate, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("campaigns").document(campaign_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow().isoformat()
    doc_ref.update(update_data)
    return {"success": True}

@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    doc_ref = db.collection("campaigns").document(campaign_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Campaign not found")
    doc_ref.delete()
    return {"success": True}


@router.post("/{campaign_id}/launch")
async def launch_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    """
    Execute a broadcast campaign — send WhatsApp messages to target leads.
    """
    db = get_db()
    
    doc_ref = db.collection("campaigns").document(campaign_id)
    doc = doc_ref.get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    campaign = doc.to_dict()
    
    
    leads_ref = db.collection("leads").where("userId", "==", user["uid"])
    target_status = campaign.get("targetStatus", "All")
    if target_status and target_status != "All":
        leads_ref = leads_ref.where("status", "==", target_status)
        
    leads = [{"id": d.id, **d.to_dict()} for d in leads_ref.stream()]
    if not leads:
        raise HTTPException(status_code=400, detail="No leads match the target criteria")
    
    
    doc_ref.update({
        "status": "running",
        "targetCount": len(leads),
        "startedAt": datetime.utcnow().isoformat(),
    })
    
    phone_numbers = []
    for lead in leads:
        phone = lead.get("phone")
        if phone:
            phone_numbers.append(phone)
            
    
    results = send_bulk_messages(phone_numbers, campaign.get("message", ""))
    
    
    
    
    
    
    
    doc_ref.update({
        "status": "completed",
        "sentCount": results["sent"],
        "failedCount": results["failed"],
        "completedAt": datetime.utcnow().isoformat(),
    })
    
    pass
    return {
        "success": True,
        "targetCount": len(leads),
        "sentCount": results["sent"],
        "failedCount": results["failed"],
    }


@router.get("/{campaign_id}/stats")
async def get_campaign_stats(campaign_id: str, user: dict = Depends(get_current_user)):
    """Get delivery statistics for a campaign."""
    db = get_db()
    doc = db.collection("campaigns").document(campaign_id).get()
    if not doc.exists or doc.to_dict().get("userId") != user["uid"]:
        raise HTTPException(status_code=404, detail="Campaign not found")
    data = doc.to_dict()
    target = data.get("targetCount", 1)
    return {
        "id": campaign_id,
        **data,
        "deliveryRate": round((data.get("sentCount", 0) / max(target, 1)) * 100, 1),
        "failureRate": round((data.get("failedCount", 0) / max(target, 1)) * 100, 1),
    }
