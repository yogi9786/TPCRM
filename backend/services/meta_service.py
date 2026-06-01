"""
Meta (Facebook/Instagram) Lead Ads Service
"""
import hmac
import hashlib
import requests
from config import META_APP_SECRET, META_PAGE_ACCESS_TOKEN, META_APP_ID


def verify_meta_signature(payload: bytes, signature: str) -> bool:
    """Verify the X-Hub-Signature-256 header from Meta webhook."""
    if not signature.startswith("sha256="):
        return False
    expected = hmac.new(
        META_APP_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature[7:])


def get_lead_details(leadgen_id: str) -> dict:
    """
    Fetch lead form field data from Meta Graph API.
    """
    url = f"https://graph.facebook.com/v21.0/{leadgen_id}"
    params = {
        "access_token": META_PAGE_ACCESS_TOKEN,
        "fields": "field_data,created_time,id,ad_id,form_id,campaign_id",
    }
    response = requests.get(url, params=params, timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        # Convert field_data list to dict
        field_dict = {}
        for field in data.get("field_data", []):
            field_dict[field["name"]] = field["values"][0] if field.get("values") else ""
        data["field_data"] = field_dict
        return data
    else:
        return {"error": response.text, "status": response.status_code}


def subscribe_page_to_webhook(page_id: str) -> dict:
    """Subscribe a Facebook page to the leadgen webhook."""
    url = f"https://graph.facebook.com/v21.0/{page_id}/subscribed_apps"
    params = {
        "subscribed_fields": "leadgen",
        "access_token": META_PAGE_ACCESS_TOKEN,
    }
    response = requests.post(url, params=params, timeout=10)
    return response.json()
