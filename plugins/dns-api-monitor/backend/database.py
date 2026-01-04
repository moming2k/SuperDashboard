"""
Database models for DNS & API Monitor plugin
"""
from sqlalchemy import Column, String, Integer, Text, DateTime, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import sys
import os

# Add parent directory to path to import shared database
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
from plugins.shared.database import Base

class DNSMonitor(Base):
    """Model for DNS CNAME monitors"""
    __tablename__ = "dns_monitors"
    
    id = Column(String, primary_key=True, index=True)
    domain = Column(String, nullable=False, index=True)
    check_interval = Column(Integer, default=300)
    last_cname = Column(String, nullable=True)
    last_check = Column(DateTime, nullable=True)
    changes_detected = Column(Integer, default=0)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DNSMonitorHistory(Base):
    """Model for DNS monitor change history"""
    __tablename__ = "dns_monitor_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    monitor_id = Column(String, ForeignKey("dns_monitors.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    old_value = Column(String)
    new_value = Column(String)
    change_type = Column(String)


class APIMonitor(Base):
    """Model for API endpoint monitors"""
    __tablename__ = "api_monitors"
    
    id = Column(String, primary_key=True, index=True)
    url = Column(String, nullable=False)
    method = Column(String, default="GET")
    headers = Column(JSON, nullable=True)
    body = Column(Text, nullable=True)
    check_interval = Column(Integer, default=300)
    last_hash = Column(String, nullable=True)
    last_response = Column(JSON, nullable=True)
    last_check = Column(DateTime, nullable=True)
    last_error = Column(String, nullable=True)
    changes_detected = Column(Integer, default=0)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class APIMonitorHistory(Base):
    """Model for API monitor change history"""
    __tablename__ = "api_monitor_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    monitor_id = Column(String, ForeignKey("api_monitors.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    old_hash = Column(String)
    new_hash = Column(String)
    status_code = Column(Integer)
    change_type = Column(String)
