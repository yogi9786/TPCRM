"""
Meta (Facebook/Instagram) Lead Ads webhook router
"""
from fastapi import APIRouter, Request, HTTPException, Query, Response
from datetime import datetime
from services.firebase_service import get_db
from services.meta_service import verify_meta_signature, get_lead_details
from config import META_VERIFY_TOKEN
import logging
import json

router = APIRouter(prefix="/meta", tags=["meta"])
logger = logging.getLogger(__name__)


@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """
    Meta webhook verification endpoint.
    Facebook calls this GET to confirm ownership.
    """
    if hub_mode == "subscribe" and hub_verify_token == META_VERIFY_TOKEN:
        logger.info("Meta webhook verified successfully")
        return Response(content=hub_challenge, media_type="text/plain")
    
    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/webhook")
async def receive_webhook(request: Request):
    """
    Receive lead form submission events from Meta.
    Meta sends a POST with leadgen events when someone submits a Lead Ad form.
    """
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    
    # Verify signature (optional but recommended)
    if not verify_meta_signature(body, signature):
        logger.warning("Meta webhook signature mismatch — processing anyway")
    
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    
    db = get_db()
    
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            if change.get("field") == "leadgen":
                value = change.get("value", {})
                leadgen_id = value.get("leadgen_id")
                
                if leadgen_id:
                    # Fetch full lead data from Meta Graph API
                    lead_data = get_lead_details(leadgen_id)
                    
                    if "error" not in lead_data:
                        # Save to Firestore meta_leads collection
                        doc = {
                            "leadgenId": leadgen_id,
                            "formId": value.get("form_id", ""),
                            "pageId": value.get("page_id", ""),
                            "adId": value.get("ad_id"),
                            "adsetId": value.get("adset_id"),
                            "campaignId": value.get("campaign_id"),
                            "fieldData": lead_data.get("field_data", {}),
                            "importedToCRM": False,
                            "createdAt": datetime.utcnow().isoformat(),
                        }
                        db.collection("meta_leads").add(doc)
                        logger.info(f"Meta lead {leadgen_id} saved to Firestore")
    
    return {"status": "ok"}


@router.get("/leads")
async def get_meta_leads(imported: bool = None):
    """Get all Meta lead submissions."""
    db = get_db()
    ref = db.collection("meta_leads")
    if imported is not None:
        ref = ref.where("importedToCRM", "==", imported)
    docs = ref.order_by("createdAt", direction="DESCENDING").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.post("/leads/{meta_lead_id}/import")
async def import_meta_lead(meta_lead_id: str, user_id: str):
    """Import a Meta lead into the CRM leads collection."""
    db = get_db()
    meta_ref = db.collection("meta_leads").document(meta_lead_id)
    meta_doc = meta_ref.get()
    
    if not meta_doc.exists:
        raise HTTPException(status_code=404, detail="Meta lead not found")
    
    meta_data = meta_doc.to_dict()
    field_data = meta_data.get("fieldData", {})
    
    now = datetime.utcnow().isoformat()
    lead = {
        "fullName": field_data.get("full_name") or field_data.get("name", "Meta Lead"),
        "email": field_data.get("email", ""),
        "phone": field_data.get("phone_number") or field_data.get("phone", ""),
        "companyName": field_data.get("company_name", ""),
        "leadSource": "Facebook Ads",
        "serviceInterested": "Meta Lead Ad",
        "status": "New",
        "notes": f"Imported from Meta Form ID: {meta_data.get('formId')}",
        "userId": user_id,
        "createdAt": now,
        "updatedAt": now,
    }
    
    lead_ref = db.collection("leads").add(lead)
    meta_ref.update({"importedToCRM": True, "crmLeadId": lead_ref[1].id})
    
    return {"success": True, "lead_id": lead_ref[1].id}
