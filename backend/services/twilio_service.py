"""
Twilio WhatsApp Service
"""
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER


def get_twilio_client() -> Client:
    return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def format_whatsapp_number(phone: str) -> str:
    """Ensure number is in WhatsApp format: whatsapp:+91XXXXXXXXXX"""
    cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
    if not cleaned.startswith('+'):
        cleaned = '+91' + cleaned  
    if not cleaned.startswith('whatsapp:'):
        cleaned = f'whatsapp:{cleaned}'
    return cleaned


def send_whatsapp_message(to: str, body: str, media_url: str = None) -> dict:
    """
    Send a WhatsApp message via Twilio.
    Returns message SID and status.
    """
    client = get_twilio_client()
    to_wa = format_whatsapp_number(to)
    
    try:
        kwargs = {
            "body": body,
            "from_": TWILIO_WHATSAPP_NUMBER,
            "to": to_wa
        }
        if media_url:
            kwargs["media_url"] = [media_url]
            
        message = client.messages.create(**kwargs)
        return {
            "success": True,
            "sid": message.sid,
            "status": message.status,
            "to": to_wa,
        }
    except TwilioRestException as e:
        return {
            "success": False,
            "error": str(e),
            "code": e.code,
        }


def send_bulk_messages(phone_numbers: list[str], body: str, media_url: str = None) -> dict:
    """Send message to multiple WhatsApp numbers."""
    results = {"sent": 0, "failed": 0, "errors": []}
    
    for phone in phone_numbers:
        result = send_whatsapp_message(phone, body, media_url)
        if result["success"]:
            results["sent"] += 1
        else:
            results["failed"] += 1
            results["errors"].append({"phone": phone, "error": result.get("error")})
    
    return results
