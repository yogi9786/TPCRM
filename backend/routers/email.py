"""
Email router — send, history, logs via Brevo
"""
from fastapi_cache.decorator import cache
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from services.firebase_service import get_db
from services.email_service import send_email, get_smtp_logs, get_smtp_log_detail
from auth import get_current_user
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter(prefix="/email", tags=["email"])


class EmailSendRequest(BaseModel):
    to_email: str
    to_name: str
    subject: str
    html_content: str
    text_content: Optional[str] = ""
    reply_to: Optional[str] = None
    lead_id: Optional[str] = None  
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None


class EmailChatMessage(BaseModel):
    lead_id: str
    to_email: str
    to_name: str
    subject: str
    body: str  


@router.post("/send")
async def send_transactional_email(
    req: EmailSendRequest,
    user: dict = Depends(get_current_user),
):
    """Send a transactional email via Brevo and log it to Firestore."""
    result = send_email(
        to_email=req.to_email,
        to_name=req.to_name,
        subject=req.subject,
        html_content=req.html_content,
        text_content=req.text_content or "",
        reply_to=req.reply_to,
        attachment_url=req.attachment_url,
        attachment_name=req.attachment_name,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=502,
            detail=f"Brevo error: {result.get('error', 'Unknown error')}",
        )

    
    db = get_db()
    doc = {
        "userId": user["uid"],
        "leadId": req.lead_id or "",
        "toEmail": req.to_email,
        "toName": req.to_name,
        "subject": req.subject,
        "body": req.html_content,
        "direction": "outbound",
        "brevoMessageId": result.get("messageId", ""),
        "status": "sent",
        "attachmentUrl": req.attachment_url,
        "attachmentName": req.attachment_name,
        "createdAt": datetime.utcnow().isoformat(),
    }
    db.collection("emails").add(doc)

    pass
    return {"success": True, "messageId": result.get("messageId")}


@router.post("/chat/send")
async def send_chat_email(
    req: EmailChatMessage,
    user: dict = Depends(get_current_user),
):
    """Send a chat-style plain-text email to a lead and store in email thread."""
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; color: #1e293b;">
      <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 16px 24px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0; font-size: 16px;">Message from TekhPortal CRM</h2>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">{req.body}</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">Sent via TekhPortal CRM &bull; Reply to this email to respond.</p>
      </div>
    </div>
    """

    result = send_email(
        to_email=req.to_email,
        to_name=req.to_name,
        subject=req.subject,
        html_content=html,
        text_content=req.body,
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=502,
            detail=f"Brevo error: {result.get('error', 'Unknown error')}",
        )

    db = get_db()
    doc = {
        "userId": user["uid"],
        "leadId": req.lead_id,
        "toEmail": req.to_email,
        "toName": req.to_name,
        "subject": req.subject,
        "body": req.body,
        "direction": "outbound",
        "brevoMessageId": result.get("messageId", ""),
        "status": "sent",
        "createdAt": datetime.utcnow().isoformat(),
    }
    db.collection("emails").add(doc)
    return {"success": True, "messageId": result.get("messageId")}


@router.get("/history")
@cache(expire=30)
async def get_email_history(
    lead_id: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    """Get email history from Firestore, optionally filtered by lead."""
    db = get_db()
    ref = db.collection("emails").where(filter=FieldFilter("userId", "==", user["uid"]))
    if lead_id:
        ref = ref.where(filter=FieldFilter("leadId", "==", lead_id))
    try:
        docs = ref.order_by("createdAt", direction="DESCENDING").limit(limit).stream()
        return [{"id": d.id, **d.to_dict()} for d in docs]
    except Exception as e:
        if "requires an index" in str(e) or "currently building" in str(e):
            pass
            docs = ref.stream()
            results = [{"id": d.id, **d.to_dict()} for d in docs]
            results.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
            return results[:limit]
        raise e


@router.get("/logs/brevo")
@cache(expire=30)
async def get_brevo_logs(
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(get_current_user),
):
    """Fetch raw SMTP send logs from Brevo dashboard."""
    result = get_smtp_logs(limit=limit, offset=offset)
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    return result


@router.get("/logs/brevo/{message_id}")
@cache(expire=30)
async def get_brevo_log_detail(
    message_id: str,
    user: dict = Depends(get_current_user),
):
    """Fetch detail of a single sent email from Brevo."""
    result = get_smtp_log_detail(message_id)
    if "error" in result:
        raise HTTPException(status_code=502, detail=result["error"])
    return result
