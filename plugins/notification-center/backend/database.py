"""
Database models for Notification Center plugin
"""
from sqlalchemy import Column, String, Text, Boolean, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import sys
import os

# Add parent directory to path to import shared database
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
from plugins.shared.database import Base


class Notification(Base):
    """Model for notifications"""
    __tablename__ = "notifications"
    
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    source = Column(String, nullable=False, index=True)
    priority = Column(String, default="medium", index=True)
    type = Column(String, nullable=False, index=True)
    status = Column(String, default="unread", index=True)
    url = Column(String, nullable=True)
    notification_metadata = Column(JSON, default={})  # Renamed from 'metadata' (reserved word)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class NotificationRule(Base):
    """Model for notification filtering rules"""
    __tablename__ = "notification_rules"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    enabled = Column(Boolean, default=True, index=True)
    conditions = Column(JSON, nullable=False)
    actions = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
