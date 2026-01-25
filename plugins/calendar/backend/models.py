"""
Calendar Plugin - Database Models
SQLAlchemy models for calendar events using shared database
"""
from sqlalchemy import Column, String, DateTime, Boolean, Integer, Text
from datetime import datetime

from shared.database import Base


class CalendarEvent(Base):
    """Calendar event model"""
    __tablename__ = "calendar_events"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    location = Column(String, nullable=True)
    color = Column(String, default="#3B82F6")  # Default blue color
    all_day = Column(Boolean, default=False)
    reminder_minutes = Column(Integer, default=15)  # Minutes before event
    recurrence = Column(String, default="none")  # none, daily, weekly, monthly
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert model to dictionary"""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "location": self.location,
            "color": self.color,
            "all_day": self.all_day,
            "reminder_minutes": self.reminder_minutes,
            "recurrence": self.recurrence,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
