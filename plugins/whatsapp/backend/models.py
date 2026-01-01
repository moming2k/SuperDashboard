"""
WhatsApp message database models.
"""
from sqlalchemy import Column, String, Text, DateTime
from datetime import datetime
import sys
import os

# Add shared directory to path
plugin_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, plugin_root)

from shared.database import Base



class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id = Column(String(50), primary_key=True)  # Twilio MessageSid
    from_number = Column(String(50), nullable=False)
    to_number = Column(String(50), nullable=False)
    body = Column(Text, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    direction = Column(String(20), nullable=False)  # 'inbound' or 'outbound'
    status = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary for API response"""
        return {
            "id": self.id,
            "from_number": self.from_number,
            "to_number": self.to_number,
            "body": self.body,
            "timestamp": self.timestamp.isoformat() if isinstance(self.timestamp, datetime) else self.timestamp,
            "direction": self.direction,
            "status": self.status
        }
