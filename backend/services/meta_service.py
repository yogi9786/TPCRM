"""
Meta (Facebook/Instagram) Lead Ads Service
Full Graph API integration: leads, forms, campaigns, ad accounts, webhooks
"""
import hmac
import hashlib
import os
import requests
from typing import Optional
from config import META_APP_SECRET, META_PAGE_ACCESS_TOKEN, META_APP_ID, META_PAGE_ID, META_AD_ACCOUNT_ID, META_VERIFY_TOKEN

GRAPH_BASE = "https://graph.facebook.com/v21.0"


# ── Signature Verification ─────────────────────────────────────────────────────

def verify_meta_signature(payload: bytes, signature: str) -> bool:
    """Verify the X-Hub-Signature-256 header from Meta webhook."""
    if not signature or not signature.startswith("sha256="):
        return False
    if not META_APP_SECRET or META_APP_SECRET in ("", "your_app_secret", "YOUR_META_APP_SECRET_HERE"):
        # Allow through when not configured (dev mode)
        return True
    mac = hmac.new(META_APP_SECRET.encode(), payload, hashlib.sha256)
    expected = mac.hexdigest()
    try:
        return hmac.compare_digest(expected, signature[7:])
    except Exception:
        return False


# ── Lead Details ───────────────────────────────────────────────────────────────

def get_lead_details(leadgen_id: str) -> dict:
    """
    Fetch lead form field data from Meta Graph API.
    Returns a dict with field_data already mapped name→value.
    """
    if not META_PAGE_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN in ("", "YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN_HERE"):
        return {"error": "META_PAGE_ACCESS_TOKEN not configured", "status": 401}

    url = f"{GRAPH_BASE}/{leadgen_id}"
    params = {
        "access_token": META_PAGE_ACCESS_TOKEN,
        "fields": "field_data,created_time,id,ad_id,form_id,campaign_id,ad_name,adset_name,campaign_name",
    }
    try:
        response = requests.get(url, params=params, timeout=15)
        if response.status_code == 200:
            data = response.json()
            # Flatten field_data list → dict
            field_dict = {}
            for field in data.get("field_data", []):
                field_dict[field["name"]] = field["values"][0] if field.get("values") else ""
            data["field_data"] = field_dict
            return data
        else:
            return {"error": response.text, "status": response.status_code}
    except Exception as e:
        return {"error": str(e), "status": 500}


# ── Lead Forms ─────────────────────────────────────────────────────────────────

def get_lead_forms(page_id: Optional[str] = None) -> dict:
    """List all lead gen forms for the configured (or specified) page."""
    pid = page_id or META_PAGE_ID
    if not pid or pid in ("", "YOUR_PAGE_ID_HERE"):
        return {"error": "META_PAGE_ID not configured", "data": []}
    if not META_PAGE_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN in ("", "YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN_HERE"):
        return {"error": "META_PAGE_ACCESS_TOKEN not configured", "data": []}

    url = f"{GRAPH_BASE}/{pid}/leadgen_forms"
    params = {
        "access_token": META_PAGE_ACCESS_TOKEN,
        "fields": "id,name,status,leads_count,created_time,questions",
        "limit": 50,
    }
    try:
        response = requests.get(url, params=params, timeout=15)
        if response.status_code == 200:
            return response.json()
        return {"error": response.json(), "data": []}
    except Exception as e:
        return {"error": str(e), "data": []}


def fetch_leads_from_form(form_id: str, limit: int = 100) -> dict:
    """Bulk-fetch all leads submitted to a specific lead form."""
    if not META_PAGE_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN in ("", "YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN_HERE"):
        return {"error": "META_PAGE_ACCESS_TOKEN not configured", "data": []}

    url = f"{GRAPH_BASE}/{form_id}/leads"
    params = {
        "access_token": META_PAGE_ACCESS_TOKEN,
        "fields": "id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id",
        "limit": limit,
    }
    try:
        response = requests.get(url, params=params, timeout=20)
        if response.status_code == 200:
            data = response.json()
            # Flatten field_data for each lead
            for lead in data.get("data", []):
                field_dict = {}
                for field in lead.get("field_data", []):
                    field_dict[field["name"]] = field["values"][0] if field.get("values") else ""
                lead["field_data"] = field_dict
            return data
        return {"error": response.json(), "data": []}
    except Exception as e:
        return {"error": str(e), "data": []}


# ── Ad Accounts ────────────────────────────────────────────────────────────────

def get_ad_accounts() -> dict:
    """Fetch ad accounts linked to the user/app token."""
    if not META_PAGE_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN in ("", "YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN_HERE"):
        return {"error": "META_PAGE_ACCESS_TOKEN not configured", "data": []}

    url = f"{GRAPH_BASE}/me/adaccounts"
    params = {
        "access_token": META_PAGE_ACCESS_TOKEN,
        "fields": "id,name,account_id,account_status,currency,timezone_name,spend_cap,amount_spent",
        "limit": 25,
    }
    try:
        response = requests.get(url, params=params, timeout=15)
        if response.status_code == 200:
            return response.json()
        return {"error": response.json(), "data": []}
    except Exception as e:
        return {"error": str(e), "data": []}


# ── Meta Ad Campaigns ──────────────────────────────────────────────────────────

def get_meta_campaigns(ad_account_id: Optional[str] = None) -> dict:
    """
    Fetch ad campaigns from the Meta Ads account.
    Returns campaigns with insights: impressions, clicks, spend, leads.
    """
    account_id = ad_account_id or META_AD_ACCOUNT_ID
    if not account_id or account_id in ("", "act_YOUR_AD_ACCOUNT_ID_HERE"):
        return {"error": "META_AD_ACCOUNT_ID not configured", "data": []}
    if not META_PAGE_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN in ("", "YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN_HERE"):
        return {"error": "META_PAGE_ACCESS_TOKEN not configured", "data": []}

    url = f"{GRAPH_BASE}/{account_id}/campaigns"
    params = {
        "access_token": META_PAGE_ACCESS_TOKEN,
        "fields": "id,name,status,objective,start_time,stop_time,daily_budget,lifetime_budget,insights{impressions,clicks,spend,actions,cpc,cpm,ctr}",
        "limit": 50,
    }
    try:
        response = requests.get(url, params=params, timeout=20)
        if response.status_code == 200:
            data = response.json()
            # Parse insights into flat structure
            for camp in data.get("data", []):
                insights_data = camp.get("insights", {}).get("data", [{}])
                insight = insights_data[0] if insights_data else {}
                # Extract lead count from actions
                leads = 0
                for action in insight.get("actions", []):
                    if action.get("action_type") in ("lead", "onsite_conversion.lead_grouped"):
                        leads += int(action.get("value", 0))
                camp["metrics"] = {
                    "impressions": int(insight.get("impressions", 0)),
                    "clicks": int(insight.get("clicks", 0)),
                    "spend": float(insight.get("spend", 0)),
                    "cpc": float(insight.get("cpc", 0) or 0),
                    "cpm": float(insight.get("cpm", 0) or 0),
                    "ctr": float(insight.get("ctr", 0) or 0),
                    "leads": leads,
                }
            return data
        return {"error": response.json(), "data": []}
    except Exception as e:
        return {"error": str(e), "data": []}


def get_historical_conversations(page_id: Optional[str] = None, platform: str = "MESSENGER") -> dict:
    """Fetch existing conversations and messages from Meta Page."""
    pid = page_id or META_PAGE_ID
    if not pid or pid in ("", "YOUR_PAGE_ID_HERE"):
        return {"error": "META_PAGE_ID not configured"}

    url = f"{GRAPH_BASE}/{pid}/conversations"
    params = {
        "access_token": META_PAGE_ACCESS_TOKEN,
        "platform": platform,
        "fields": "id,updated_time,participants,messages.limit(20){id,message,created_time,from,to,attachments}",
        "limit": 50,
    }
    try:
        response = requests.get(url, params=params, timeout=15)
        return response.json()
    except Exception as e:
        return {"error": str(e)}

def send_message_to_meta(recipient_id: str, text: str) -> dict:
    """Send a message response to a Meta user (Facebook or Instagram) using the Page Token."""
    if not META_PAGE_ACCESS_TOKEN or META_PAGE_ACCESS_TOKEN in ("", "YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN_HERE"):
        return {"error": "META_PAGE_ACCESS_TOKEN not configured"}
        
    pid = META_PAGE_ID
    if not pid or pid in ("", "YOUR_PAGE_ID_HERE"):
        return {"error": "META_PAGE_ID not configured"}
        
    url = f"{GRAPH_BASE}/{pid}/messages"
    params = {"access_token": META_PAGE_ACCESS_TOKEN}
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": text},
        "messaging_type": "RESPONSE"
    }
    
    try:
        response = requests.post(url, params=params, json=payload, timeout=15)
        return response.json()
    except Exception as e:
        return {"error": str(e)}

# ── Webhook Subscription ───────────────────────────────────────────────────────

def subscribe_page_to_webhook(page_id: Optional[str] = None) -> dict:
    """Subscribe a Facebook page to leadgen + messages webhook fields."""
    pid = page_id or META_PAGE_ID
    if not pid or pid in ("", "YOUR_PAGE_ID_HERE"):
        return {"error": "META_PAGE_ID not configured"}

    url = f"{GRAPH_BASE}/{pid}/subscribed_apps"
    params = {
        "subscribed_fields": "leadgen,messages,messaging_postbacks,feed",
        "access_token": META_PAGE_ACCESS_TOKEN,
    }
    try:
        response = requests.post(url, params=params, timeout=15)
        return response.json()
    except Exception as e:
        return {"error": str(e)}


def get_webhook_subscriptions(page_id: Optional[str] = None) -> dict:
    """Get current webhook subscriptions for the page."""
    pid = page_id or META_PAGE_ID
    if not pid or pid in ("", "YOUR_PAGE_ID_HERE"):
        return {"error": "META_PAGE_ID not configured"}

    url = f"{GRAPH_BASE}/{pid}/subscribed_apps"
    params = {"access_token": META_PAGE_ACCESS_TOKEN}
    try:
        response = requests.get(url, params=params, timeout=15)
        return response.json()
    except Exception as e:
        return {"error": str(e)}


# ── Token Exchange ─────────────────────────────────────────────────────────────

def exchange_short_to_long_token(short_token: str) -> dict:
    """Exchange a short-lived user token for a long-lived one (60 days)."""
    if not META_APP_ID or not META_APP_SECRET:
        return {"error": "META_APP_ID and META_APP_SECRET must be configured"}

    url = f"{GRAPH_BASE}/oauth/access_token"
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": META_APP_ID,
        "client_secret": META_APP_SECRET,
        "fb_exchange_token": short_token,
    }
    try:
        response = requests.get(url, params=params, timeout=15)
        return response.json()
    except Exception as e:
        return {"error": str(e)}


# ── Configuration Check ────────────────────────────────────────────────────────

def get_meta_config_status() -> dict:
    """Check which Meta credentials are configured."""
    placeholders = {"", "YOUR_META_APP_ID_HERE", "YOUR_META_APP_SECRET_HERE",
                    "YOUR_PAGE_ID_HERE", "YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN_HERE",
                    "act_YOUR_AD_ACCOUNT_ID_HERE", "your_app_secret", "your_page_id"}
    return {
        "app_id_set": bool(META_APP_ID) and META_APP_ID not in placeholders,
        "app_secret_set": bool(META_APP_SECRET) and META_APP_SECRET not in placeholders,
        "page_access_token_set": bool(META_PAGE_ACCESS_TOKEN) and META_PAGE_ACCESS_TOKEN not in placeholders,
        "page_id_set": bool(META_PAGE_ID) and META_PAGE_ID not in placeholders,
        "ad_account_id_set": bool(META_AD_ACCOUNT_ID) and META_AD_ACCOUNT_ID not in placeholders,
        "webhook_verify_token": META_VERIFY_TOKEN,
        "webhook_callback_url": f"{os.getenv('BACKEND_URL', 'https://tpcrm.onrender.com')}/api/meta/webhook",
        "fully_configured": all([
            META_APP_ID not in placeholders and META_APP_ID,
            META_APP_SECRET not in placeholders and META_APP_SECRET,
            META_PAGE_ACCESS_TOKEN not in placeholders and META_PAGE_ACCESS_TOKEN,
            META_PAGE_ID not in placeholders and META_PAGE_ID,
        ])
    }
