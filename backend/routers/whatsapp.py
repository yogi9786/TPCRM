"""
WhatsApp router — Send messages and receive Twilio webhooks
"""
from fastapi import APIRouter, Request, HTTPException, Form, Response
from datetime import datetime
from models.message import SendMessageRequest
from services.firebase_service import get_db
from services.twilio_service import send_whatsapp_message, send_bulk_messages
import logging

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])
logger = logging.getLogger(__name__)


@router.post("/send")
async def send_message(req: SendMessageRequest):
    """
    Send a single WhatsApp message via Twilio.
    Saves the attempt to the local DB regardless of outcome.
    """
    db = get_db()

    result = send_whatsapp_message(req.to, req.body)

    # Persist message log (success or failure)
    msg_data = {
        "leadId": req.lead_id or "",
        "phone": req.to,
        "direction": "outbound",
        "body": req.body,
        "status": "sent" if result["success"] else "failed",
        "twilioSid": result.get("sid"),
        "createdAt": datetime.utcnow().isoformat(),
    }
    try:
        db.collection("messages").add(msg_data)
    except Exception as db_err:
        logger.warning(f"Could not save message log: {db_err}")

    if not result["success"]:
        twilio_code = result.get("code")
        raw_error  = result.get("error", "Failed to send message")

        # Map common Twilio error codes to helpful messages
        TWILIO_ERRORS = {
            63007: (
                "Sandbox opt-in required: the recipient must first send "
                "'join <your-sandbox-word>' to +14155238886 on WhatsApp before "
                "messages can be delivered."
            ),
            63031: (
                "Cannot send to yourself: the To and From numbers must be different. "
                "Your number (+917996633015) joined the sandbox but cannot receive messages "
                "sent FROM the same account that owns it. Try sending to a different WhatsApp number."
            ),
            63016: "The recipient's WhatsApp number is invalid or not registered on WhatsApp.",
            21211: "Invalid 'To' phone number — include the country code, e.g. +91XXXXXXXXXX.",
            21608: "The 'To' number is not a valid mobile number.",
            21614: "Phone number is not a valid mobile number.",
            20003: "Twilio authentication failed — check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env.",
        }

        friendly = TWILIO_ERRORS.get(twilio_code, raw_error)
        logger.error(f"Twilio error {twilio_code}: {raw_error}")
        raise HTTPException(
            status_code=400,
            detail={"message": friendly, "twilio_code": twilio_code, "raw": raw_error},
        )

    return {"success": True, "sid": result.get("sid"), "status": result.get("status")}



@router.post("/broadcast")
async def broadcast_message(campaign_id: str, message: str, phone_numbers: list[str]):
    """
    Send a message to multiple numbers (campaign broadcast).
    """
    db = get_db()
    results = send_bulk_messages(phone_numbers, message)
    
    # Update campaign stats
    campaign_ref = db.collection("campaigns").document(campaign_id)
    campaign_ref.update({
        "sentCount": results["sent"],
        "failedCount": results["failed"],
        "status": "completed",
        "completedAt": datetime.utcnow().isoformat(),
    })
    
    return results


@router.post("/webhook")
async def twilio_webhook(
    request: Request,
    From: str = Form(None),
    Body: str = Form(None),
    MessageSid: str = Form(None),
    MessageStatus: str = Form(None),
    To: str = Form(None),
):
    """
    Twilio webhook for incoming WhatsApp messages and status updates.
    Configure this URL in Twilio Console → Messaging → WhatsApp Sandbox.
    """
    db = get_db()
    
    if Body and From:
        # Incoming message
        logger.info(f"Incoming WA message from {From}: {Body}")
        
        # Find matching lead
        phone_cleaned = From.replace("whatsapp:", "").replace("+91", "")
        leads = db.collection("leads").where("phone", ">=", phone_cleaned).limit(1).stream()
        lead_id = ""
        for lead in leads:
            lead_id = lead.id
            break
        
        # Save message
        db.collection("messages").add({
            "leadId": lead_id,
            "phone": From.replace("whatsapp:", ""),
            "direction": "inbound",
            "body": Body,
            "status": "delivered",
            "twilioSid": MessageSid,
            "createdAt": datetime.utcnow().isoformat(),
        })
    
    elif MessageStatus and MessageSid:
        # Status update — find message and update status
        logger.info(f"Message {MessageSid} status: {MessageStatus}")
        msgs_ref = db.collection("messages").where("twilioSid", "==", MessageSid).stream()
        for msg_doc in msgs_ref:
            try:
                # Real Firestore DocumentSnapshot has .reference
                msg_doc.reference.update({"status": MessageStatus})
            except AttributeError:
                # MockDocument — use the collection API instead
                db.collection("messages").document(msg_doc.id).update({"status": MessageStatus})
    
    # Return TwiML response (empty is fine)
    return Response(content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>', media_type="application/xml")


@router.get("/messages/all")
async def get_all_messages():
    """Get all messages (for the message log view)."""
    db = get_db()
    msgs = db.collection("messages").stream()
    result = [{"id": m.id, **m.to_dict()} for m in msgs]
    result.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return result


@router.get("/messages/{lead_id}")
async def get_messages(lead_id: str):
    """Get all messages for a lead."""
    db = get_db()
    msgs = db.collection("messages").where("leadId", "==", lead_id).stream()
    return [{"id": m.id, **m.to_dict()} for m in msgs]
