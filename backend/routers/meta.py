"""
Meta (Facebook/Instagram) Lead Ads + Messaging router
Handles: webhook verification, lead import, Meta Messenger messages, sync
"""
from fastapi import APIRouter, Request, HTTPException, Query, Response, Depends, Body
from datetime import datetime
from services.firebase_service import get_db
from services.meta_service import (
    verify_meta_signature, get_lead_details, get_lead_forms,
    fetch_leads_from_form, get_meta_config_status, get_historical_conversations
)
from config import META_VERIFY_TOKEN
from auth import get_current_user
from typing import Optional
import json

router = APIRouter(prefix="/meta", tags=["meta"])

GRAPH_BASE = "https://graph.facebook.com/v21.0"


# ── Webhook Verification (GET) ─────────────────────────────────────────────────

@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """Meta webhook verification endpoint."""
    if hub_mode == "subscribe" and hub_verify_token == META_VERIFY_TOKEN:
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Webhook verification failed")


# ── Webhook Receiver (POST) ────────────────────────────────────────────────────

@router.post("/webhook")
async def receive_webhook(request: Request):
    """
    Unified webhook receiver for:
      - leadgen events  → auto-imports lead into CRM
      - messages events → saves to meta_messages collection
      - messaging_postbacks, messaging_reads, etc.
    """
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    verify_meta_signature(body, signature)  # logs mismatch but doesn't block

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    db = get_db()
    now = datetime.utcnow().isoformat()
    leads_processed = 0
    messages_processed = 0

    for entry in payload.get("entry", []):
        page_id = entry.get("id", "")

        # ── Lead Gen Events ────────────────────────────────────────────
        for change in entry.get("changes", []):
            field = change.get("field", "")
            value = change.get("value", {})

            if field == "leadgen":
                leadgen_id = value.get("leadgen_id")
                if not leadgen_id:
                    continue

                existing = list(db.collection("meta_leads").where("leadgenId", "==", leadgen_id).stream())
                if existing:
                    continue

                lead_data = get_lead_details(leadgen_id)
                if "error" in lead_data and "status" in lead_data:
                    continue

                field_data = lead_data.get("field_data", {})
                source = _detect_source(value, lead_data)

                meta_doc = {
                    "leadgenId": leadgen_id,
                    "formId": value.get("form_id", lead_data.get("form_id", "")),
                    "pageId": value.get("page_id", page_id),
                    "adId": value.get("ad_id", lead_data.get("ad_id", "")),
                    "adsetId": value.get("adset_id", ""),
                    "campaignId": value.get("campaign_id", lead_data.get("campaign_id", "")),
                    "adName": lead_data.get("ad_name", ""),
                    "adsetName": lead_data.get("adset_name", ""),
                    "campaignName": lead_data.get("campaign_name", ""),
                    "fieldData": field_data,
                    "source": source,
                    "importedToCRM": True,
                    "createdAt": now,
                    "metaCreatedTime": lead_data.get("created_time", now),
                }
                meta_ref = db.collection("meta_leads").add(meta_doc)
                meta_lead_id = meta_ref[1].id

                full_name = (
                    field_data.get("full_name") or
                    field_data.get("name") or
                    f"{field_data.get('first_name', '')} {field_data.get('last_name', '')}".strip() or
                    "Meta Lead"
                )
                crm_lead = {
                    "fullName": full_name,
                    "email": field_data.get("email", ""),
                    "phone": field_data.get("phone_number") or field_data.get("phone", ""),
                    "companyName": field_data.get("company_name", ""),
                    "leadSource": source,
                    "serviceInterested": field_data.get("service_interested", "Meta Lead Ad"),
                    "status": "New",
                    "notes": _build_notes(field_data, meta_doc),
                    "metaLeadId": meta_lead_id,
                    "metaFormId": meta_doc["formId"],
                    "metaCampaignId": meta_doc["campaignId"],
                    "metaCampaignName": meta_doc["campaignName"],
                    "metaAdName": meta_doc["adName"],
                    "tags": ["meta", source.lower().replace(" ", "-")],
                    "userId": "auto_imported",
                    "createdAt": now,
                    "updatedAt": now,
                }
                lead_ref = db.collection("leads").add(crm_lead)
                db.collection("meta_leads").document(meta_lead_id).update({"crmLeadId": lead_ref[1].id})

                db.collection("lead_activities").add({
                    "leadId": lead_ref[1].id,
                    "type": "meta_import",
                    "title": "Lead imported from Meta Ads",
                    "description": f"Auto-imported via {source}",
                    "metadata": {"formId": meta_doc["formId"], "fieldData": field_data},
                    "createdAt": now,
                })
                leads_processed += 1

        # ── Messaging Events (Facebook/Instagram Messenger) ────────────
        for messaging_event in entry.get("messaging", []):
            sender_id = messaging_event.get("sender", {}).get("id", "")
            recipient_id = messaging_event.get("recipient", {}).get("id", "")
            timestamp_ms = messaging_event.get("timestamp", 0)
            ts = datetime.utcfromtimestamp(timestamp_ms / 1000).isoformat() if timestamp_ms else now

            # Text messages
            if "message" in messaging_event:
                msg = messaging_event["message"]
                text = msg.get("text", "")
                mid = msg.get("mid", "")
                attachments = msg.get("attachments", [])
                is_echo = msg.get("is_echo", False)

                # Skip echoes from page itself unless you want to store them
                direction = "outbound" if is_echo else "inbound"

                # Avoid duplicates
                if mid:
                    ex = list(db.collection("meta_messages").where("mid", "==", mid).stream())
                    if ex:
                        continue

                msg_doc = {
                    "mid": mid,
                    "senderId": sender_id,
                    "recipientId": recipient_id,
                    "pageId": page_id,
                    "direction": direction,
                    "text": text,
                    "attachments": [
                        {"type": a.get("type", ""), "url": a.get("payload", {}).get("url", "")}
                        for a in attachments
                    ],
                    "source": "instagram" if "instagram" in str(entry.get("id", "")).lower() else "facebook",
                    "timestamp": ts,
                    "createdAt": now,
                    "read": False,
                }
                db.collection("meta_messages").add(msg_doc)
                messages_processed += 1

            # Postbacks (button clicks)
            elif "postback" in messaging_event:
                pb = messaging_event["postback"]
                msg_doc = {
                    "mid": f"postback_{sender_id}_{timestamp_ms}",
                    "senderId": sender_id,
                    "recipientId": recipient_id,
                    "pageId": page_id,
                    "direction": "inbound",
                    "text": f"[Postback] {pb.get('title', '')} → {pb.get('payload', '')}",
                    "attachments": [],
                    "source": "facebook",
                    "timestamp": ts,
                    "createdAt": now,
                    "read": False,
                }
                db.collection("meta_messages").add(msg_doc)
                messages_processed += 1

    return {"status": "ok", "leads_processed": leads_processed, "messages_processed": messages_processed}


# ── Config & Status ────────────────────────────────────────────────────────────

@router.get("/config/status")
async def get_config_status(user: dict = Depends(get_current_user)):
    """Check which Meta credentials are configured."""
    return get_meta_config_status()


# ── Meta Leads ─────────────────────────────────────────────────────────────────

@router.get("/leads")
async def get_meta_leads(
    imported: Optional[bool] = None,
    source: Optional[str] = None,
    form_id: Optional[str] = None,
    limit: int = 100,
    user: dict = Depends(get_current_user)
):
    """Get all Meta lead submissions stored in Firestore."""
    db = get_db()
    ref = db.collection("meta_leads")
    if imported is not None:
        ref = ref.where("importedToCRM", "==", imported)
    if source:
        ref = ref.where("source", "==", source)
    if form_id:
        ref = ref.where("formId", "==", form_id)

    docs = ref.order_by("createdAt", direction="DESCENDING").stream()
    leads = [{"id": d.id, **d.to_dict()} for d in docs]
    return leads[:limit]


@router.get("/leads/stats")
async def get_meta_lead_stats(user: dict = Depends(get_current_user)):
    """Aggregate stats for Meta leads."""
    db = get_db()
    docs = db.collection("meta_leads").stream()
    leads = [d.to_dict() for d in docs]

    return {
        "total": len(leads),
        "imported": sum(1 for l in leads if l.get("importedToCRM")),
        "pending": sum(1 for l in leads if not l.get("importedToCRM")),
        "facebook": sum(1 for l in leads if l.get("source") == "Facebook Ads"),
        "instagram": sum(1 for l in leads if l.get("source") == "Instagram Ads"),
    }


@router.post("/leads/{meta_lead_id}/import")
async def import_meta_lead(meta_lead_id: str, user: dict = Depends(get_current_user)):
    """Manually import a Meta lead into the CRM leads collection."""
    db = get_db()
    meta_ref = db.collection("meta_leads").document(meta_lead_id)
    meta_doc = meta_ref.get()

    if not meta_doc.exists:
        raise HTTPException(status_code=404, detail="Meta lead not found")

    meta_data = meta_doc.to_dict()
    if meta_data.get("importedToCRM") and meta_data.get("crmLeadId"):
        return {"success": True, "lead_id": meta_data["crmLeadId"], "already_imported": True}

    field_data = meta_data.get("fieldData", {})
    now = datetime.utcnow().isoformat()
    full_name = (
        field_data.get("full_name") or field_data.get("name") or
        f"{field_data.get('first_name', '')} {field_data.get('last_name', '')}".strip() or
        "Meta Lead"
    )
    lead = {
        "fullName": full_name,
        "email": field_data.get("email", ""),
        "phone": field_data.get("phone_number") or field_data.get("phone", ""),
        "companyName": field_data.get("company_name", ""),
        "leadSource": meta_data.get("source", "Facebook Ads"),
        "serviceInterested": field_data.get("service_interested", "Meta Lead Ad"),
        "status": "New",
        "notes": _build_notes(field_data, meta_data),
        "metaLeadId": meta_lead_id,
        "metaFormId": meta_data.get("formId", ""),
        "metaCampaignId": meta_data.get("campaignId", ""),
        "metaCampaignName": meta_data.get("campaignName", ""),
        "metaAdName": meta_data.get("adName", ""),
        "tags": ["meta"],
        "userId": user["uid"],
        "createdAt": now,
        "updatedAt": now,
    }
    lead_ref = db.collection("leads").add(lead)
    meta_ref.update({"importedToCRM": True, "crmLeadId": lead_ref[1].id})
    return {"success": True, "lead_id": lead_ref[1].id}


@router.post("/leads/import-all")
async def import_all_meta_leads(user: dict = Depends(get_current_user)):
    """Import all pending Meta leads into CRM."""
    db = get_db()
    pending = db.collection("meta_leads").where("importedToCRM", "==", False).stream()
    imported = 0
    errors = 0
    for doc in pending:
        meta_data = doc.to_dict()
        field_data = meta_data.get("fieldData", {})
        now = datetime.utcnow().isoformat()
        try:
            full_name = (
                field_data.get("full_name") or field_data.get("name") or
                f"{field_data.get('first_name', '')} {field_data.get('last_name', '')}".strip() or
                "Meta Lead"
            )
            lead = {
                "fullName": full_name,
                "email": field_data.get("email", ""),
                "phone": field_data.get("phone_number") or field_data.get("phone", ""),
                "leadSource": meta_data.get("source", "Facebook Ads"),
                "serviceInterested": "Meta Lead Ad",
                "status": "New",
                "notes": _build_notes(field_data, meta_data),
                "metaLeadId": doc.id,
                "tags": ["meta"],
                "userId": user["uid"],
                "createdAt": now,
                "updatedAt": now,
            }
            lead_ref = db.collection("leads").add(lead)
            db.collection("meta_leads").document(doc.id).update({
                "importedToCRM": True, "crmLeadId": lead_ref[1].id
            })
            imported += 1
        except Exception:
            errors += 1
    return {"success": True, "imported": imported, "errors": errors}


# ── Messages ───────────────────────────────────────────────────────────────────

@router.get("/messages")
async def get_meta_messages(
    source: Optional[str] = None,
    sender_id: Optional[str] = None,
    unread_only: bool = False,
    limit: int = 200,
    user: dict = Depends(get_current_user)
):
    """Fetch all Meta Messenger / Instagram DM messages from Firestore."""
    db = get_db()
    ref = db.collection("meta_messages")
    if source:
        ref = ref.where("source", "==", source)
    if sender_id:
        ref = ref.where("senderId", "==", sender_id)
    if unread_only:
        ref = ref.where("read", "==", False)

    docs = ref.order_by("timestamp", direction="DESCENDING").stream()
    messages = [{"id": d.id, **d.to_dict()} for d in docs]
    return messages[:limit]


@router.get("/messages/stats")
async def get_message_stats(user: dict = Depends(get_current_user)):
    """Message stats: total, unread, by source."""
    db = get_db()
    docs = list(db.collection("meta_messages").stream())
    msgs = [d.to_dict() for d in docs]
    senders = set(m.get("senderId", "") for m in msgs if m.get("direction") == "inbound")
    return {
        "total": len(msgs),
        "inbound": sum(1 for m in msgs if m.get("direction") == "inbound"),
        "outbound": sum(1 for m in msgs if m.get("direction") == "outbound"),
        "unread": sum(1 for m in msgs if not m.get("read") and m.get("direction") == "inbound"),
        "unique_senders": len(senders),
        "facebook": sum(1 for m in msgs if m.get("source") == "facebook"),
        "instagram": sum(1 for m in msgs if m.get("source") == "instagram"),
    }


@router.get("/messages/conversations")
async def get_conversations(user: dict = Depends(get_current_user)):
    """Group messages by sender (conversation threads)."""
    db = get_db()
    docs = db.collection("meta_messages").order_by("timestamp", direction="DESCENDING").stream()
    msgs = [{"id": d.id, **d.to_dict()} for d in docs]

    # Group by senderId
    convos: dict = {}
    for m in msgs:
        sid = m.get("senderId", "unknown")
        if sid not in convos:
            convos[sid] = {
                "senderId": sid,
                "source": m.get("source", "facebook"),
                "lastMessage": m.get("text", ""),
                "lastTimestamp": m.get("timestamp", ""),
                "unreadCount": 0,
                "messageCount": 0,
                "messages": [],
            }
        convos[sid]["messageCount"] += 1
        if not m.get("read") and m.get("direction") == "inbound":
            convos[sid]["unreadCount"] += 1
        convos[sid]["messages"].append(m)

    result = sorted(convos.values(), key=lambda x: x["lastTimestamp"], reverse=True)
    return result


@router.patch("/messages/{message_id}/read")
async def mark_message_read(message_id: str, user: dict = Depends(get_current_user)):
    """Mark a message as read."""
    db = get_db()
    db.collection("meta_messages").document(message_id).update({"read": True})
    return {"success": True}


@router.patch("/messages/conversations/{sender_id}/read")
async def mark_conversation_read(sender_id: str, user: dict = Depends(get_current_user)):
    """Mark all messages in a conversation as read."""
    db = get_db()
    msgs = db.collection("meta_messages").where("senderId", "==", sender_id).stream()
    batch = db.batch()
    for doc in msgs:
        batch.update(doc.reference, {"read": True})
    batch.commit()
    return {"success": True}


@router.post("/messages/sync")
async def sync_meta_messages(user: dict = Depends(get_current_user)):
    """Pull historical messages from Meta Page."""
    config = get_meta_config_status()
    if not config.get("page_access_token_set") or not config.get("page_id_set"):
        raise HTTPException(status_code=400, detail="Page Token and Page ID required")

    data = get_historical_conversations()
    if "error" in data:
        raise HTTPException(status_code=400, detail=str(data["error"]))

    convos = data.get("data", [])
    db = get_db()
    new_messages = 0

    page_id = config.get("page_id_set")

    for convo in convos:
        # Each convo has a participants list and messages list
        participants = convo.get("participants", {}).get("data", [])
        if not participants: continue
        
        # Find the other person (not the page)
        # We don't strictly know our own name easily, but usually participants has 2 people
        # Try to find someone who is not the page
        sender = participants[0] if len(participants) == 1 else participants[1]
        sender_id = sender.get("id", "unknown")
        
        msgs = convo.get("messages", {}).get("data", [])
        for m in msgs:
            mid = m.get("id", "")
            if not mid: continue
            
            # Skip duplicates
            existing = list(db.collection("meta_messages").where("mid", "==", mid).stream())
            if existing: continue

            # Determine direction
            # If from.id == sender_id, it's inbound. Else it's outbound.
            from_id = m.get("from", {}).get("id", "")
            direction = "inbound" if from_id == sender_id else "outbound"

            msg_doc = {
                "mid": mid,
                "senderId": sender_id,
                "recipientId": "page",
                "pageId": "page",
                "direction": direction,
                "text": m.get("message", ""),
                "attachments": [],
                "source": "facebook",  # Graph API usually returns FB messages here unless it's IG specific
                "timestamp": m.get("created_time", ""),
                "createdAt": datetime.utcnow().isoformat() + "Z",
                "read": True, # Mark historical as read by default
            }
            db.collection("meta_messages").add(msg_doc)
            new_messages += 1

    return {"status": "success", "new_messages_synced": new_messages}


# ── Sync from Meta Graph API ───────────────────────────────────────────────────

@router.post("/sync")
async def sync_meta_leads(user: dict = Depends(get_current_user)):
    """Pull latest leads from all Meta lead forms via Graph API."""
    config = get_meta_config_status()
    if not config.get("page_access_token_set"):
        raise HTTPException(status_code=400, detail="META_PAGE_ACCESS_TOKEN not configured")
    if not config.get("page_id_set"):
        raise HTTPException(status_code=400, detail="META_PAGE_ID not configured")

    forms_result = get_lead_forms()
    if "error" in forms_result:
        raise HTTPException(status_code=400, detail=str(forms_result["error"]))

    forms = forms_result.get("data", [])
    if not forms:
        return {"message": "No lead forms found for this page", "synced": 0}

    db = get_db()
    total_synced = 0

    for form in forms:
        form_id = form.get("id")
        if not form_id:
            continue
        leads_result = fetch_leads_from_form(form_id)
        for meta_lead in leads_result.get("data", []):
            leadgen_id = meta_lead.get("id")
            if not leadgen_id:
                continue
            existing = list(db.collection("meta_leads").where("leadgenId", "==", leadgen_id).stream())
            if existing:
                continue

            field_data = meta_lead.get("field_data", {})
            now = datetime.utcnow().isoformat()
            meta_doc = {
                "leadgenId": leadgen_id,
                "formId": form_id,
                "formName": form.get("name", ""),
                "adId": meta_lead.get("ad_id", ""),
                "adName": meta_lead.get("ad_name", ""),
                "campaignId": meta_lead.get("campaign_id", ""),
                "campaignName": meta_lead.get("campaign_name", ""),
                "fieldData": field_data,
                "source": "Facebook Ads",
                "importedToCRM": True,
                "createdAt": now,
                "metaCreatedTime": meta_lead.get("created_time", now),
            }
            meta_ref = db.collection("meta_leads").add(meta_doc)
            meta_lead_id = meta_ref[1].id

            full_name = (
                field_data.get("full_name") or field_data.get("name") or
                f"{field_data.get('first_name', '')} {field_data.get('last_name', '')}".strip() or
                "Meta Lead"
            )
            crm_lead = {
                "fullName": full_name,
                "email": field_data.get("email", ""),
                "phone": field_data.get("phone_number") or field_data.get("phone", ""),
                "leadSource": "Facebook Ads",
                "serviceInterested": "Meta Lead Ad",
                "status": "New",
                "notes": _build_notes(field_data, meta_doc),
                "metaLeadId": meta_lead_id,
                "metaFormId": form_id,
                "tags": ["meta", "synced"],
                "userId": user["uid"],
                "createdAt": now,
                "updatedAt": now,
            }
            lead_ref = db.collection("leads").add(crm_lead)
            db.collection("meta_leads").document(meta_lead_id).update({"crmLeadId": lead_ref[1].id})
            total_synced += 1

    return {"success": True, "forms_checked": len(forms), "new_leads_synced": total_synced}


# ── Webhook Subscription ───────────────────────────────────────────────────────

@router.post("/subscribe")
async def subscribe_webhook(
    page_id: Optional[str] = Body(None, embed=True),
    user: dict = Depends(get_current_user)
):
    """Subscribe the Facebook page to leadgen + messages webhook."""
    from services.meta_service import subscribe_page_to_webhook
    result = subscribe_page_to_webhook(page_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=str(result["error"]))
    return {"success": True, "result": result}


@router.get("/subscription-status")
async def get_subscription_status(user: dict = Depends(get_current_user)):
    """Check current webhook subscription status."""
    from services.meta_service import get_webhook_subscriptions
    return get_webhook_subscriptions()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _detect_source(webhook_value: dict, lead_data: dict) -> str:
    ad_name = (lead_data.get("ad_name", "") or "").lower()
    campaign_name = (lead_data.get("campaign_name", "") or "").lower()
    if "instagram" in ad_name or "instagram" in campaign_name or "ig" in ad_name:
        return "Instagram Ads"
    return "Facebook Ads"


def _build_notes(field_data: dict, meta_data: dict) -> str:
    lines = []
    skip = {"full_name", "name", "first_name", "last_name", "email", "phone_number", "phone", "company_name", "service_interested"}
    for key, value in field_data.items():
        if key not in skip and value:
            lines.append(f"{key.replace('_', ' ').title()}: {value}")
    if meta_data.get("campaignName"):
        lines.append(f"Campaign: {meta_data['campaignName']}")
    if meta_data.get("adName"):
        lines.append(f"Ad: {meta_data['adName']}")
    if meta_data.get("formId"):
        lines.append(f"Form ID: {meta_data['formId']}")
    return "\n".join(lines) if lines else f"Imported from Meta Ads"
