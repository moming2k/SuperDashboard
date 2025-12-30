import os
import httpx
from typing import Dict, Any, List
from datetime import datetime
from .base import WhatsAppProvider, WhatsAppMessage


class MetaProvider(WhatsAppProvider):
    """Meta (Facebook) WhatsApp Business API Provider"""

    def __init__(self):
        self.token = os.getenv("WHATSAPP_TOKEN")
        self.phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
        self.api_version = os.getenv("WHATSAPP_API_VERSION", "v18.0")
        self.verify_token = os.getenv("WHATSAPP_VERIFY_TOKEN", "superdashboard_verify_token")

    def is_configured(self) -> bool:
        return bool(self.token and self.phone_number_id)

    async def send_message(self, to: str, message: str) -> Dict[str, Any]:
        """Send WhatsApp message via Meta API"""
        if not self.is_configured():
            raise ValueError("WhatsApp credentials not configured")

        url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {
                "preview_url": False,
                "body": message
            }
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)

            if response.status_code != 200:
                raise Exception(f"WhatsApp API Error: {response.text}")

            data = response.json()
            return {
                "success": True,
                "message_id": data.get("messages", [{}])[0].get("id"),
                "status": "sent"
            }

    async def get_message_status(self, message_id: str) -> str:
        """Get message status - Meta provides this via webhooks"""
        return "unknown"

    def verify_webhook(self, request_data: Dict[str, Any]) -> bool:
        """Verify Meta webhook"""
        mode = request_data.get("hub.mode")
        token = request_data.get("hub.verify_token")
        return mode == "subscribe" and token == self.verify_token

    async def parse_incoming_message(self, webhook_data: Dict[str, Any]) -> List[WhatsAppMessage]:
        """Parse Meta webhook data"""
        messages = []

        if webhook_data.get("object") == "whatsapp_business_account":
            for entry in webhook_data.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})

                    if "messages" in value:
                        for message in value["messages"]:
                            msg = WhatsAppMessage(
                                id=message.get("id"),
                                from_number=message.get("from"),
                                to_number=value.get("metadata", {}).get("display_phone_number", ""),
                                message=message.get("text", {}).get("body", ""),
                                timestamp=datetime.fromtimestamp(int(message.get("timestamp"))).isoformat(),
                                status="received",
                                message_type=message.get("type", "text")
                            )
                            messages.append(msg)

        return messages
