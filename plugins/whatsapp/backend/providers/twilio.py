import os
import httpx
from typing import Dict, Any, List
from datetime import datetime
from .base import WhatsAppProvider, WhatsAppMessage


class TwilioProvider(WhatsAppProvider):
    """Twilio WhatsApp API Provider"""

    def __init__(self):
        self.account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        self.auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        self.from_number = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")  # Twilio sandbox
        self.api_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"

    def is_configured(self) -> bool:
        return bool(self.account_sid and self.auth_token)

    async def send_message(self, to: str, message: str) -> Dict[str, Any]:
        """Send WhatsApp message via Twilio"""
        if not self.is_configured():
            raise ValueError("Twilio credentials not configured")

        # Format phone number for WhatsApp
        to_number = f"whatsapp:+{to}" if not to.startswith("whatsapp:") else to

        data = {
            "From": self.from_number,
            "To": to_number,
            "Body": message
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.api_url,
                data=data,
                auth=(self.account_sid, self.auth_token)
            )

            if response.status_code not in [200, 201]:
                raise Exception(f"Twilio API Error: {response.text}")

            result = response.json()
            return {
                "success": True,
                "message_id": result["sid"],
                "status": result["status"]
            }

    async def get_message_status(self, message_id: str) -> str:
        """Get message status from Twilio"""
        url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages/{message_id}.json"

        async with httpx.AsyncClient() as client:
            response = await client.get(url, auth=(self.account_sid, self.auth_token))

            if response.status_code == 200:
                data = response.json()
                return data.get("status", "unknown")

        return "unknown"

    def verify_webhook(self, request_data: Dict[str, Any]) -> bool:
        """Verify Twilio webhook signature"""
        # For production, implement Twilio signature validation
        # https://www.twilio.com/docs/usage/webhooks/webhooks-security
        return True

    async def parse_incoming_message(self, webhook_data: Dict[str, Any]) -> List[WhatsAppMessage]:
        """Parse Twilio webhook data"""
        messages = []

        # Twilio sends form-encoded data
        from_number = webhook_data.get("From", "").replace("whatsapp:+", "")
        to_number = webhook_data.get("To", "").replace("whatsapp:+", "")
        body = webhook_data.get("Body", "")
        message_sid = webhook_data.get("MessageSid", "")

        if from_number and body:
            msg = WhatsAppMessage(
                id=message_sid,
                from_number=from_number,
                to_number=to_number,
                message=body,
                timestamp=datetime.now().isoformat(),
                status="received",
                message_type="text"
            )
            messages.append(msg)

        return messages
