import os
from fastapi import APIRouter, HTTPException, Body, Request
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

from providers.base import WhatsAppMessage
from providers.twilio import TwilioProvider
from providers.meta import MetaProvider
from providers.whatsapp_web import WhatsAppWebProvider

load_dotenv()

router = APIRouter()

# In-memory storage (replace with database in production)
messages_db = []

# Auto-detect provider based on environment variables
def get_provider():
    """Automatically select provider based on available credentials"""
    provider_type = os.getenv("WHATSAPP_PROVIDER", "auto").lower()

    if provider_type == "twilio" or (provider_type == "auto" and os.getenv("TWILIO_ACCOUNT_SID")):
        return TwilioProvider()
    elif provider_type == "meta" or (provider_type == "auto" and os.getenv("WHATSAPP_TOKEN")):
        return MetaProvider()
    elif provider_type == "whatsapp-web" or (provider_type == "auto" and os.getenv("WHATSAPP_WEB_SERVER_URL")):
        return WhatsAppWebProvider()
    else:
        # Default to Meta
        return MetaProvider()

provider = get_provider()

class SendMessageRequest(BaseModel):
    to: str
    message: str
    message_type: str = "text"

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    provider_name = provider.__class__.__name__.replace("Provider", "")
    return {
        "status": "healthy",
        "provider": provider_name,
        "configured": provider.is_configured()
    }

@router.get("/webhook")
async def verify_webhook(request: Request):
    """Webhook verification endpoint"""
    query_params = dict(request.query_params)

    if provider.verify_webhook(query_params):
        challenge = query_params.get("hub.challenge")
        if challenge:
            return int(challenge)
        return {"status": "verified"}

    raise HTTPException(status_code=403, detail="Verification failed")

@router.post("/webhook")
async def receive_webhook(request: Request):
    """Webhook endpoint to receive incoming messages"""
    try:
        # Handle both JSON and form data
        content_type = request.headers.get("content-type", "")

        if "application/json" in content_type:
            data = await request.json()
        else:
            # Form-encoded (Twilio uses this)
            form_data = await request.form()
            data = dict(form_data)

        # Parse messages using provider
        incoming_messages = await provider.parse_incoming_message(data)

        # Store messages
        for msg in incoming_messages:
            messages_db.append(msg)

        return {"status": "ok", "messages_received": len(incoming_messages)}

    except Exception as e:
        print(f"Webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/messages/send")
async def send_message(request: SendMessageRequest):
    """Send a WhatsApp message"""
    if not provider.is_configured():
        raise HTTPException(
            status_code=400,
            detail=f"{provider.__class__.__name__} not configured. Please set required environment variables."
        )

    try:
        result = await provider.send_message(request.to, request.message)

        # Store sent message
        from datetime import datetime
        msg = WhatsAppMessage(
            id=result.get("message_id"),
            from_number=getattr(provider, 'phone_number_id', 'system'),
            to_number=request.to,
            message=request.message,
            timestamp=datetime.now().isoformat(),
            status=result.get("status", "sent"),
            message_type=request.message_type
        )
        messages_db.append(msg)

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/messages", response_model=List[WhatsAppMessage])
async def get_messages(phone_number: Optional[str] = None):
    """Get all messages, optionally filtered by phone number"""
    if phone_number:
        return [
            msg for msg in messages_db
            if msg.from_number == phone_number or msg.to_number == phone_number
        ]
    return messages_db

@router.get("/conversations")
async def get_conversations():
    """Get list of unique conversations"""
    system_number = getattr(provider, 'phone_number_id', 'system')
    phone_numbers = set()

    for msg in messages_db:
        if msg.from_number != system_number:
            phone_numbers.add(msg.from_number)
        if msg.to_number != system_number:
            phone_numbers.add(msg.to_number)

    conversations = []
    for phone in phone_numbers:
        conv_messages = [
            msg for msg in messages_db
            if msg.from_number == phone or msg.to_number == phone
        ]

        if conv_messages:
            latest = max(conv_messages, key=lambda m: m.timestamp)
            conversations.append({
                "phone_number": phone,
                "last_message": latest.message,
                "last_message_time": latest.timestamp,
                "unread_count": sum(
                    1 for m in conv_messages
                    if m.status == "received" and m.from_number == phone
                ),
                "message_count": len(conv_messages)
            })

    conversations.sort(key=lambda c: c["last_message_time"], reverse=True)
    return conversations

@router.delete("/messages")
async def clear_messages():
    """Clear all messages"""
    messages_db.clear()
    return {"message": "All messages cleared"}

@router.get("/messages/{message_id}")
async def get_message(message_id: str):
    """Get a specific message by ID"""
    for msg in messages_db:
        if msg.id == message_id:
            return msg
    raise HTTPException(status_code=404, detail="Message not found")

@router.get("/provider/info")
async def get_provider_info():
    """Get current provider information"""
    return {
        "provider": provider.__class__.__name__.replace("Provider", ""),
        "configured": provider.is_configured(),
        "description": provider.__doc__
    }
