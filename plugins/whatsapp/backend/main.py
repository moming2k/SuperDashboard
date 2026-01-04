import os
from fastapi import APIRouter, HTTPException, Request, Form, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
import sys
import os
import importlib.util

# Add paths for imports
plugin_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, plugin_root)

from shared.database import get_db, init_db

# Load WhatsApp models using importlib to avoid conflicts
models_path = os.path.join(os.path.dirname(__file__), 'models.py')
spec = importlib.util.spec_from_file_location("whatsapp_models", models_path)
whatsapp_models = importlib.util.module_from_spec(spec)
spec.loader.exec_module(whatsapp_models)
WhatsAppMessageModel = whatsapp_models.WhatsAppMessage

load_dotenv()

router = APIRouter()

# Twilio credentials from environment
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER")  # Format: whatsapp:+1234567890
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Database availability flag
database_available = False

# Initialize database tables
try:
    init_db()
    database_available = True
    print("📱 WhatsApp database tables initialized")
except Exception as e:
    print(f"⚠️  WhatsApp database initialization error: {e}")
    print("   Plugin will work with limited functionality (no message persistence)")



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
async def send_whatsapp_message(request: SendMessageRequest, db: Session = Depends(get_db)):
    """Send a WhatsApp message via Twilio"""
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER]):
        raise HTTPException(
            status_code=400,
            detail="Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER"
        )

    try:
        from twilio.rest import Client

        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

        # Format phone number for WhatsApp - strip existing + to avoid double ++
        phone_clean = request.to.lstrip('+')
        to_number = f"whatsapp:+{phone_clean}" if not request.to.startswith("whatsapp:") else request.to

        # Send message via Twilio
        message = client.messages.create(
            from_=TWILIO_WHATSAPP_NUMBER,
            body=request.body,
            to=to_number
        )

        # Store in database
        msg = WhatsAppMessageModel(
            id=message.sid,
            from_number=TWILIO_WHATSAPP_NUMBER,
            to_number=to_number,
            body=request.body,
            timestamp=datetime.utcnow(),
            direction="outbound",
            status=message.status
        )
        db.add(msg)
        db.commit()

        return {
            "success": True,
            "message_id": message.sid,
            "status": message.status,
            "to": to_number
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")


@router.post("/webhook")
async def whatsapp_webhook(
    From: str = Form(...),
    Body: str = Form(...),
    MessageSid: str = Form(...),
    To: str = Form(None),
    db: Session = Depends(get_db)
):
    """Receive incoming WhatsApp messages from Twilio webhook"""
    try:
        print(f"📱 Incoming WhatsApp message from {From}: {Body}")

        # Store incoming message
        msg = WhatsAppMessageModel(
            id=MessageSid,
            from_number=From,
            to_number=To or TWILIO_WHATSAPP_NUMBER,
            body=Body,
            timestamp=datetime.utcnow(),
            direction="inbound",
            status="received"
        )
        db.add(msg)
        db.commit()

        # Process with AI agent if enabled
        if OPENAI_API_KEY:
            try:
                ai_response = await process_with_ai(Body)
                print(f"🤖 AI Response: {ai_response}")

                # Send AI response back via WhatsApp
                from twilio.rest import Client
                client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

                # Split message if it's too long
                message_chunks = split_message(ai_response, max_length=1500)
                
                for i, chunk in enumerate(message_chunks):
                    # Add part indicator if message was split
                    if len(message_chunks) > 1:
                        chunk_with_indicator = f"[Part {i+1}/{len(message_chunks)}]\\n\\n{chunk}"
                    else:
                        chunk_with_indicator = chunk
                    
                    response_message = client.messages.create(
                        from_=TWILIO_WHATSAPP_NUMBER,
                        body=chunk_with_indicator,
                        to=From
                    )

                    # Store AI response in database
                    ai_msg = WhatsAppMessageModel(
                        id=response_message.sid,
                        from_number=TWILIO_WHATSAPP_NUMBER,
                        to_number=From,
                        body=chunk_with_indicator,
                        timestamp=datetime.utcnow(),
                        direction="outbound",
                        status=response_message.status
                    )
                    db.add(ai_msg)
                    
                    # Small delay between messages to ensure order
                    if i < len(message_chunks) - 1:
                        import asyncio
                        await asyncio.sleep(0.5)

                db.commit()

            except Exception as e:
                print(f"❌ ERROR processing with AI: {str(e)}")
                db.rollback()

        # Return empty response
        return {"status": "received"}

    except Exception as e:
        print(f"❌ ERROR in webhook: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


def split_message(text: str, max_length: int = 4000) -> list:
    """Split long messages into chunks that fit WhatsApp's character limit"""
    if len(text) <= max_length:
        return [text]
    
    chunks = []
    current_chunk = ""
    
    # Split by paragraphs first
    paragraphs = text.split('\\n\\n')
    
    for para in paragraphs:
        # If adding this paragraph would exceed limit, save current chunk
        if len(current_chunk) + len(para) + 2 > max_length:
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = ""
            
            # If single paragraph is too long, split by sentences
            if len(para) > max_length:
                sentences = para.split('. ')
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) + 2 > max_length:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                        current_chunk = sentence + '. '
                    else:
                        current_chunk += sentence + '. '
            else:
                current_chunk = para + '\\n\\n'
        else:
            current_chunk += para + '\\n\\n'
    
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    return chunks


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
                    "content": "You are a helpful AI assistant integrated with WhatsApp. Provide concise, friendly, and helpful responses. Keep your answers VERY brief (under 1000 characters) since they'll be sent via WhatsApp."
                },
                {"role": "user", "content": user_message}
            ],
            max_tokens=300
        )

        return response.choices[0].message.content

    except Exception as e:
        return f"Sorry, I encountered an error processing your message: {str(e)}"


@router.get("/messages")
async def get_messages(phone_number: Optional[str] = None, limit: int = 100, db: Session = Depends(get_db)):
    """Get message history, optionally filtered by phone number"""
    query = db.query(WhatsAppMessageModel)
    
    if phone_number:
        # Format phone number for filtering - strip existing + to avoid double ++
        phone_clean = phone_number.lstrip('+')
        formatted_phone = f"whatsapp:+{phone_clean}" if not phone_number.startswith("whatsapp:") else phone_number
        query = query.filter(
            or_(
                WhatsAppMessageModel.from_number == formatted_phone,
                WhatsAppMessageModel.to_number == formatted_phone
            )
        )
    
    messages = query.order_by(WhatsAppMessageModel.timestamp.desc()).limit(limit).all()
    return [msg.to_dict() for msg in reversed(messages)]


@router.get("/conversations")
async def get_conversations(db: Session = Depends(get_db)):
    """Get list of unique conversations with metadata"""
    # Get all messages
    messages = db.query(WhatsAppMessageModel).order_by(WhatsAppMessageModel.timestamp.desc()).all()
    
    conversations = {}

    for msg in messages:
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
        messages_list = data["messages"]
        latest_message = max(messages_list, key=lambda m: m.timestamp)

        result.append({
            "phone_number": phone.replace("whatsapp:+", "").replace("whatsapp:", ""),
            "last_message": latest_message.body,
            "last_message_time": latest_message.timestamp.isoformat() if isinstance(latest_message.timestamp, datetime) else latest_message.timestamp,
            "message_count": len(messages_list),
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
async def clear_messages(db: Session = Depends(get_db)):
    """Clear message history"""
    try:
        db.query(WhatsAppMessageModel).delete()
        db.commit()
        return {"status": "cleared", "message": "All messages have been cleared"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to clear messages: {str(e)}")


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

# Command Palette Integration
@router.get("/commands")
async def get_commands():
    """Return commands that this plugin provides to the Command Palette"""
    return {
        "commands": [
            {
                "id": "send-message",
                "label": "WhatsApp: Send Message",
                "description": "Send a WhatsApp message via Twilio",
                "category": "WhatsApp",
                "icon": "💬",
                "endpoint": "/send",
                "method": "POST",
                "requiresInput": True,
                "inputSchema": {
                    "type": "form",
                    "fields": [
                        {
                            "name": "to",
                            "label": "Phone Number",
                            "type": "text",
                            "required": True,
                            "placeholder": "14155551234 (without whatsapp: prefix)"
                        },
                        {
                            "name": "body",
                            "label": "Message",
                            "type": "textarea",
                            "required": True,
                            "placeholder": "Your message here..."
                        }
                    ]
                }
            },
            {
                "id": "view-conversations",
                "label": "WhatsApp: View Conversations",
                "description": "List all WhatsApp conversations",
                "category": "WhatsApp",
                "icon": "📋",
                "endpoint": "/conversations",
                "method": "GET",
                "requiresInput": False
            },
            {
                "id": "clear-history",
                "label": "WhatsApp: Clear Message History",
                "description": "Delete all WhatsApp messages from database",
                "category": "WhatsApp",
                "icon": "🗑️",
                "endpoint": "/messages",
                "method": "DELETE",
                "requiresInput": False
            }
        ]
    }
