import os
import httpx
from typing import Dict, Any, List
from datetime import datetime
from .base import WhatsAppProvider, WhatsAppMessage


class WhatsAppWebProvider(WhatsAppProvider):
    """
    WhatsApp Web API Provider using whatsapp-web.js
    Requires running whatsapp-web.js server separately
    GitHub: https://github.com/pedroslopez/whatsapp-web.js
    """

    def __init__(self):
        # URL of your whatsapp-web.js server
        self.server_url = os.getenv("WHATSAPP_WEB_SERVER_URL", "http://localhost:3000")
        self.api_key = os.getenv("WHATSAPP_WEB_API_KEY", "")  # Optional API key

    def is_configured(self) -> bool:
        """Check if server URL is configured"""
        return bool(self.server_url)

    async def send_message(self, to: str, message: str) -> Dict[str, Any]:
        """Send message via whatsapp-web.js server"""
        if not self.is_configured():
            raise ValueError("WhatsApp Web server not configured")

        # Format number (e.g., 1234567890@c.us for individual chats)
        chat_id = f"{to}@c.us" if "@" not in to else to

        url = f"{self.server_url}/send-message"
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "chatId": chat_id,
            "message": message
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)

            if response.status_code != 200:
                raise Exception(f"WhatsApp Web Server Error: {response.text}")

            data = response.json()
            return {
                "success": True,
                "message_id": data.get("id", {}).get("id", ""),
                "status": "sent"
            }

    async def get_message_status(self, message_id: str) -> str:
        """Get message status"""
        # whatsapp-web.js provides this via events
        return "sent"

    def verify_webhook(self, request_data: Dict[str, Any]) -> bool:
        """Verify webhook - basic validation"""
        if self.api_key:
            return request_data.get("api_key") == self.api_key
        return True

    async def parse_incoming_message(self, webhook_data: Dict[str, Any]) -> List[WhatsAppMessage]:
        """Parse whatsapp-web.js webhook data"""
        messages = []

        # whatsapp-web.js sends different format
        if webhook_data.get("event") == "message":
            msg_data = webhook_data.get("data", {})

            from_number = msg_data.get("from", "").replace("@c.us", "")
            to_number = msg_data.get("to", "").replace("@c.us", "")
            body = msg_data.get("body", "")

            if from_number and body:
                msg = WhatsAppMessage(
                    id=msg_data.get("id", {}).get("id", ""),
                    from_number=from_number,
                    to_number=to_number,
                    message=body,
                    timestamp=str(msg_data.get("timestamp", datetime.now().timestamp())),
                    status="received",
                    message_type="text"
                )
                messages.append(msg)

        return messages
