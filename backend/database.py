"""
Database module for SuperDashboard
Handles all data persistence using PostgreSQL
"""
import os
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, Text, Boolean, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from logger import log_db_initialized

load_dotenv()

# Get database URL from environment variable
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/superdashboard")

# Create engine for PostgreSQL
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class PluginOrder(Base):
    """Model for storing plugin display order"""
    __tablename__ = "plugin_order"

    plugin_name = Column(String, primary_key=True, index=True)
    order_index = Column(Integer, nullable=False)


class Task(Base):
    """Model for storing tasks"""
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="pending")
    assigned_to = Column(String, nullable=True, default="user")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MCPServer(Base):
    """Model for storing MCP servers"""
    __tablename__ = "mcp_servers"

    name = Column(String, primary_key=True, index=True)
    url = Column(String, nullable=False)
    api_key = Column(String, nullable=True)
    status = Column(String, nullable=False, default="disconnected")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PluginState(Base):
    """Model for storing plugin state and configuration"""
    __tablename__ = "plugin_state"

    plugin_name = Column(String, primary_key=True, index=True)
    enabled = Column(Boolean, nullable=False, default=True)
    is_core = Column(Boolean, nullable=False, default=False)
    config = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SystemConfig(Base):
    """Model for storing system-wide configuration"""
    __tablename__ = "system_config"

    key = Column(String, primary_key=True, index=True)
    value = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def init_db():
    """Initialize all database tables"""
    Base.metadata.create_all(bind=engine)
    log_db_initialized()


def get_db():
    """Get database session (generator for FastAPI dependency injection)"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
