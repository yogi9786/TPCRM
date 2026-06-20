"""
Brevo (formerly Sendinblue) Email Service
Sends transactional emails via Brevo REST API v3
"""
import requests
from config import BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME


BREVO_API_URL = "https://api.brevo.com/v3"

HEADERS = {
    "accept": "application/json",
    "content-type": "application/json",
    "api-key": BREVO_API_KEY,
}


def send_email(
    to_email: str,
    to_name: str,
    subject: str,
    html_content: str,
    text_content: str = "",
    reply_to: str = None,
    attachment_url: str = None,
    attachment_name: str = None,
) -> dict:
    """Send a transactional email via Brevo API."""
    payload = {
        "sender": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
        "to": [{"email": to_email, "name": to_name}],
        "subject": subject,
        "htmlContent": html_content,
    }
    if text_content:
        payload["textContent"] = text_content
    if reply_to:
        payload["replyTo"] = {"email": reply_to}
    
    if attachment_url and attachment_name:
        payload["attachment"] = [{"url": attachment_url, "name": attachment_name}]


    try:
        response = requests.post(
            f"{BREVO_API_URL}/smtp/email",
            headers=HEADERS,
            json=payload,
            timeout=15,
        )
        if response.status_code in (200, 201):
            return {"success": True, "messageId": response.json().get("messageId")}
        else:
            pass
            return {"success": False, "error": response.text, "status": response.status_code}
    except Exception as e:
        pass
        return {"success": False, "error": str(e)}


def get_email_campaigns() -> dict:
    """Fetch email campaigns list from Brevo."""
    try:
        response = requests.get(
            f"{BREVO_API_URL}/emailCampaigns",
            headers=HEADERS,
            params={"limit": 50, "offset": 0, "sort": "desc"},
            timeout=15,
        )
        return response.json()
    except Exception as e:
        return {"error": str(e)}


def get_smtp_logs(limit: int = 50, offset: int = 0) -> dict:
    """Fetch transactional email logs (sent emails) from Brevo."""
    try:
        response = requests.get(
            f"{BREVO_API_URL}/smtp/statistics/events",
            headers=HEADERS,
            params={"limit": limit, "offset": offset, "sort": "desc"},
            timeout=15,
        )
        return response.json()
    except Exception as e:
        return {"error": str(e)}


def get_smtp_log_detail(message_id: str) -> dict:
    """Get details of a single transactional email by message ID."""
    try:
        response = requests.get(
            f"{BREVO_API_URL}/smtp/emails/{message_id}",
            headers=HEADERS,
            timeout=15,
        )
        return response.json()
    except Exception as e:
        return {"error": str(e)}


def get_contact_emails(email: str) -> dict:
    """Get all transactional emails sent to a specific contact."""
    try:
        import urllib.parse
        enc = urllib.parse.quote(email)
        response = requests.get(
            f"{BREVO_API_URL}/contacts/{enc}",
            headers=HEADERS,
            timeout=15,
        )
        return response.json()
    except Exception as e:
        return {"error": str(e)}
