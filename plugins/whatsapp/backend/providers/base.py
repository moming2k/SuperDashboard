from abc import ABC, abstractmethod
from typing import Dict, Any, List
from pydantic import BaseModel


class WhatsAppMessage(BaseModel):
    id: str = None
    from_number: str
    to_number: str
    message: str
    timestamp: str
    status: str = "sent"
    message_type: str = "text"


class WhatsAppProvider(ABC):
    """Base class for WhatsApp providers"""

    @abstractmethod
    async def send_message(self, to: str, message: str) -> Dict[str, Any]:
        """Send a WhatsApp message"""
        pass

    @abstractmethod
    async def get_message_status(self, message_id: str) -> str:
        """Get status of a sent message"""
        pass

    @abstractmethod
    def verify_webhook(self, request_data: Dict[str, Any]) -> bool:
        """Verify webhook authenticity"""
        pass

    @abstractmethod
    async def parse_incoming_message(self, webhook_data: Dict[str, Any]) -> List[WhatsAppMessage]:
        """Parse incoming webhook data"""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if provider is properly configured"""
        pass
