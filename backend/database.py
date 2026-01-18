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
    priority = Column(String, nullable=False, default="medium")  # low, medium, high, urgent
    due_date = Column(DateTime, nullable=True)
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


class DashboardLayout(Base):
    """Model for storing user's dashboard widget layout"""
    __tablename__ = "dashboard_layouts"

    user_id = Column(String, primary_key=True, index=True, default="default")  # Support multi-user in future
    layout = Column(JSON, nullable=False, default=list)  # Stores react-grid-layout format
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

class Snippet(Base):
    """Model for storing code snippets"""
    __tablename__ = "snippets"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    code = Column(Text, nullable=False)
    language = Column(String, nullable=False)
    visibility = Column(String, nullable=False, default="personal")  # personal, team, public
    tags = Column(JSON, nullable=False, default=list)  # Array of tag strings
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True, default="current_user")
    favorite = Column(Boolean, nullable=False, default=False)
    use_count = Column(Integer, nullable=False, default=0)


class SnippetVersion(Base):
    """Model for storing snippet version history"""
    __tablename__ = "snippet_versions"

    id = Column(String, primary_key=True, index=True)
    snippet_id = Column(String, nullable=False, index=True)  # Foreign key to snippets
    version = Column(Integer, nullable=False)
    code = Column(Text, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, nullable=True, default="system")


class Tag(Base):
    """Model for storing tags and their usage counts"""
    __tablename__ = "tags"

    name = Column(String, primary_key=True, index=True)
    count = Column(Integer, nullable=False, default=0)
    color = Column(String, nullable=True)
