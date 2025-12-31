import os
from fastapi import APIRouter, HTTPException, Request, Form
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# Twilio credentials from environment
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER")  # Format: whatsapp:+1234567890
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# In-memory message storage (replace with database in production)
message_history = []


class WhatsAppMessage(BaseModel):
    id: Optional[str] = None
    from_number: str
    to_number: str
    body: str
    timestamp: str
    direction: str  # 'inbound' or 'outbound'
    status: str


class SendMessageRequest(BaseModel):
    to: str  # Phone number without 'whatsapp:' prefix
    body: str


class ChatMessage(BaseModel):
    role: str
    content: str


@router.get("/health")
async def health_check():
    """Check if Twilio WhatsApp is configured"""
    return {
        "status": "healthy",
        "provider": "Twilio",
        "configured": all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER]),
        "whatsapp_number": TWILIO_WHATSAPP_NUMBER if TWILIO_WHATSAPP_NUMBER else None,
        "ai_enabled": bool(OPENAI_API_KEY)
    }


@router.post("/send")
async def send_whatsapp_message(request: SendMessageRequest):
    """Send a WhatsApp message via Twilio"""
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER]):
        raise HTTPException(
            status_code=400,
            detail="Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER"
        )

    try:
        from twilio.rest import Client

        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

        # Format phone number for WhatsApp
        to_number = f"whatsapp:+{request.to}" if not request.to.startswith("whatsapp:") else request.to

        # Send message via Twilio
        message = client.messages.create(
            from_=TWILIO_WHATSAPP_NUMBER,
            body=request.body,
            to=to_number
        )

        # Store in message history
        msg = WhatsAppMessage(
            id=message.sid,
            from_number=TWILIO_WHATSAPP_NUMBER,
            to_number=to_number,
            body=request.body,
            timestamp=datetime.now().isoformat(),
            direction="outbound",
            status=message.status
        )
        message_history.append(msg)

        return {
            "success": True,
            "message_id": message.sid,
            "status": message.status,
            "to": to_number
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")


@router.post("/webhook")
async def whatsapp_webhook(
    From: str = Form(...),
    Body: str = Form(...),
    MessageSid: str = Form(...),
    To: str = Form(None)
):
    """Receive incoming WhatsApp messages from Twilio webhook"""
    try:
        print(f"📱 Incoming WhatsApp message from {From}: {Body}")

        # Store incoming message
        msg = WhatsAppMessage(
            id=MessageSid,
            from_number=From,
            to_number=To or TWILIO_WHATSAPP_NUMBER,
            body=Body,
            timestamp=datetime.now().isoformat(),
            direction="inbound",
            status="received"
        )
        message_history.append(msg)

        # Process with AI agent if enabled
        if OPENAI_API_KEY:
            try:
                ai_response = await process_with_ai(Body)
                print(f"🤖 AI Response: {ai_response}")

                # Send AI response back via WhatsApp
                from twilio.rest import Client
                client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

                response_message = client.messages.create(
                    from_=TWILIO_WHATSAPP_NUMBER,
                    body=ai_response,
                    to=From
                )

                # Store AI response
                ai_msg = WhatsAppMessage(
                    id=response_message.sid,
                    from_number=TWILIO_WHATSAPP_NUMBER,
                    to_number=From,
                    body=ai_response,
                    timestamp=datetime.now().isoformat(),
                    direction="outbound",
                    status=response_message.status
                )
                message_history.append(ai_msg)

            except Exception as e:
                print(f"❌ ERROR processing with AI: {str(e)}")

        # Return empty response (Twilio doesn't need TwiML for this)
        return {"status": "received"}

    except Exception as e:
        print(f"❌ ERROR in webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def process_with_ai(user_message: str) -> str:
    """Process user message with OpenAI agent"""
    try:
        from openai import OpenAI

        client = OpenAI(api_key=OPENAI_API_KEY)

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful AI assistant integrated with WhatsApp. Provide concise, friendly, and helpful responses. Keep your answers brief since they'll be sent via WhatsApp."
                },
                {"role": "user", "content": user_message}
            ],
            max_tokens=500  # Keep responses reasonable for WhatsApp
        )

        return response.choices[0].message.content

    except Exception as e:
        return f"Sorry, I encountered an error processing your message: {str(e)}"


@router.get("/messages")
async def get_messages(phone_number: Optional[str] = None, limit: int = 100):
    """Get message history, optionally filtered by phone number"""
    if phone_number:
        # Format phone number for filtering
        formatted_phone = f"whatsapp:+{phone_number}" if not phone_number.startswith("whatsapp:") else phone_number

        filtered_messages = [
            msg for msg in message_history
            if msg.from_number == formatted_phone or msg.to_number == formatted_phone
        ]
        return filtered_messages[-limit:]

    return message_history[-limit:]


@router.get("/conversations")
async def get_conversations():
    """Get list of unique conversations with metadata"""
    conversations = {}

    for msg in message_history:
        # Determine the other party (not our WhatsApp number)
        other_party = msg.from_number if msg.from_number != TWILIO_WHATSAPP_NUMBER else msg.to_number

        if other_party not in conversations:
            conversations[other_party] = {
                "phone_number": other_party,
                "messages": [],
                "unread_count": 0
            }

        conversations[other_party]["messages"].append(msg)

        # Count unread (incoming messages)
        if msg.direction == "inbound":
            conversations[other_party]["unread_count"] += 1

    # Format conversations for frontend
    result = []
    for phone, data in conversations.items():
        messages = data["messages"]
        latest_message = max(messages, key=lambda m: m.timestamp)

        result.append({
            "phone_number": phone.replace("whatsapp:+", "").replace("whatsapp:", ""),
            "last_message": latest_message.body,
            "last_message_time": latest_message.timestamp,
            "message_count": len(messages),
            "unread_count": data["unread_count"]
        })

    # Sort by most recent
    result.sort(key=lambda c: c["last_message_time"], reverse=True)
    return result


@router.post("/chat")
async def chat_with_ai(messages: List[ChatMessage]):
    """Chat with AI agent (for frontend interface)"""
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=400,
            detail="OpenAI API key not configured"
        )

    try:
        from openai import OpenAI

        client = OpenAI(api_key=OPENAI_API_KEY)

        message_dicts = [{"role": m.role, "content": m.content} for m in messages]

        response = client.chat.completions.create(
            model="gpt-4",
            messages=message_dicts
        )

        return {"response": response.choices[0].message.content}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/messages")
async def clear_messages():
    """Clear message history"""
    global message_history
    message_history = []
    return {"status": "cleared", "message": "All messages have been cleared"}


@router.get("/config-instructions")
async def get_config_instructions():
    """Get instructions for configuring Twilio WhatsApp"""
    return {
        "instructions": [
            "1. Sign up for Twilio at https://www.twilio.com/try-twilio",
            "2. Get your Account SID and Auth Token from the Twilio Console",
            "3. Set up WhatsApp Sandbox or get a WhatsApp-enabled number",
            "4. Add these to your backend/.env file:",
            "   - TWILIO_ACCOUNT_SID=your_account_sid",
            "   - TWILIO_AUTH_TOKEN=your_auth_token",
            "   - TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886 (sandbox) or your number",
            "   - OPENAI_API_KEY=your_openai_key (for AI responses)",
            "5. Configure webhook URL in Twilio Console:",
            "   - Webhook URL: https://your-domain.com/plugins/whatsapp/webhook",
            "   - Method: POST",
            "6. For local development, use ngrok to expose your local server",
            "7. Restart the backend server after updating .env"
        ],
        "current_config": {
            "twilio_configured": bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN),
            "whatsapp_number": TWILIO_WHATSAPP_NUMBER or "Not set",
            "ai_enabled": bool(OPENAI_API_KEY)
        }
    }
