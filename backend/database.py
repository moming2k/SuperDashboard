"""
Database module for SuperDashboard
Handles all data persistence using PostgreSQL
"""
import os
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, Text, Boolean, DateTime, JSON, Index
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
    config = Column(JSON, nullable=True, default=lambda: {})
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
    layout = Column(JSON, nullable=False, default=lambda: [])  # Stores react-grid-layout format
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
    tags = Column(JSON, nullable=False, default=lambda: [])  # Array of tag strings
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


class Suite(Base):
    """Model for storing plugin suite definitions"""
    __tablename__ = "suites"

    name = Column(String, primary_key=True, index=True)
    display_name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String, nullable=False, default="📦")
    category = Column(String, nullable=True)
    plugins_required = Column(JSON, nullable=False, default=lambda: [])  # List of required plugin names
    plugins_recommended = Column(JSON, nullable=False, default=lambda: [])  # List of recommended plugin names
    plugins_optional = Column(JSON, nullable=False, default=lambda: [])  # List of optional plugin names
    default_config = Column(JSON, nullable=True)  # Default dashboard/AI config for suite
    onboarding_steps = Column(JSON, nullable=True)  # Onboarding wizard steps
    theme = Column(JSON, nullable=True)  # Theme customization for suite
    is_active = Column(Boolean, nullable=False, default=True)  # Whether suite is available
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserSuiteSelection(Base):
    """Model for storing user's active suite selection"""
    __tablename__ = "user_suite_selections"
    __table_args__ = (
        Index('ix_user_suite_selections_user_active', 'user_id', 'is_active'),
    )

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True, default="default")  # Support multi-user
    suite_name = Column(String, nullable=False, index=True)  # Reference to suite
    enabled_plugins = Column(JSON, nullable=False, default=lambda: [])  # List of enabled plugin names
    onboarding_data = Column(JSON, nullable=True)  # User's onboarding responses
    is_active = Column(Boolean, nullable=False, default=True)  # Current active suite for user
    activated_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =============================================================================
# Moltbook Plugin Models
# =============================================================================

class MoltbookReviewItem(Base):
    """Model for storing Moltbook review queue items (incoming/outgoing content)"""
    __tablename__ = "moltbook_review_items"
    __table_args__ = (
        Index('ix_moltbook_review_queue_type_status', 'queue_type', 'status'),
    )

    id = Column(String, primary_key=True, index=True)
    queue_type = Column(String, nullable=False)  # "incoming" or "outgoing"
    status = Column(String, nullable=False, default="pending")  # pending, approved, rejected

    # Content details
    content = Column(Text, nullable=True)
    content_type = Column(String, nullable=True)  # "comment", "post", etc.

    # For incoming posts
    post_id = Column(String, nullable=True)
    post_title = Column(String, nullable=True)
    post_content = Column(Text, nullable=True)

    # For outgoing content
    target_post_id = Column(String, nullable=True)
    target_post_title = Column(String, nullable=True)
    submolt = Column(String, nullable=True)
    title = Column(String, nullable=True)

    # Classification results
    classification = Column(JSON, nullable=True)  # AI classification result

    # Review metadata
    action = Column(String, nullable=True)  # What action was attempted (comment, post, etc.)
    rejection_reason = Column(Text, nullable=True)

    queued_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class MoltbookActivityLog(Base):
    """Model for storing Moltbook agent activity logs"""
    __tablename__ = "moltbook_activity_logs"
    __table_args__ = (
        Index('ix_moltbook_activity_action', 'action'),
    )

    id = Column(String, primary_key=True, index=True)
    action = Column(String, nullable=False)  # heartbeat_started, commented, posted, security_blocked, etc.
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class MoltbookAgentState(Base):
    """Model for storing Moltbook autonomous agent state"""
    __tablename__ = "moltbook_agent_state"

    key = Column(String, primary_key=True, index=True)  # Single row with key='default'
    running = Column(Boolean, nullable=False, default=False)
    last_heartbeat = Column(DateTime, nullable=True)
    last_post = Column(DateTime, nullable=True)
    last_comment = Column(DateTime, nullable=True)
    posts_today = Column(Integer, nullable=False, default=0)
    comments_today = Column(Integer, nullable=False, default=0)
    posts_today_reset = Column(DateTime, nullable=True)  # When to reset daily counters
    heartbeat_interval_hours = Column(Integer, nullable=False, default=4)
    auto_vote = Column(Boolean, nullable=False, default=True)
    auto_comment = Column(Boolean, nullable=False, default=True)
    auto_post = Column(Boolean, nullable=False, default=True)
    personality = Column(Text, nullable=False, default="friendly and curious AI agent interested in technology, coding, and AI developments")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MoltbookClassificationCache(Base):
    """Model for caching AI classification results to avoid repeated API calls"""
    __tablename__ = "moltbook_classification_cache"

    cache_key = Column(String, primary_key=True, index=True)  # Hash of content
    cache_type = Column(String, nullable=False)  # "incoming" or "outgoing"
    result = Column(JSON, nullable=False)  # Classification result
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)  # Cache expiration time


# =============================================================================
# AI Email Plugin Models
# =============================================================================

class Email(Base):
    """Model for storing fetched emails"""
    __tablename__ = "emails"
    __table_args__ = (
        Index('ix_emails_date', 'date'),
        Index('ix_emails_folder', 'folder'),
    )

    id = Column(String, primary_key=True, index=True)
    message_id = Column(String, unique=True, nullable=False, index=True)  # IMAP Message-ID
    subject = Column(String, nullable=True)
    sender = Column(String, nullable=False)
    recipients = Column(JSON, nullable=False, default=lambda: [])  # To addresses
    cc = Column(JSON, nullable=True, default=lambda: [])
    date = Column(DateTime, nullable=True)
    body_text = Column(Text, nullable=True)
    body_html = Column(Text, nullable=True)
    folder = Column(String, nullable=False, default="INBOX")
    is_read = Column(Boolean, nullable=False, default=False)
    has_attachments = Column(Boolean, nullable=False, default=False)
    raw_headers = Column(JSON, nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow)


class EmailAttachment(Base):
    """Model for storing email attachment metadata and markdown content"""
    __tablename__ = "email_attachments"


    id = Column(String, primary_key=True, index=True)
    email_id = Column(String, nullable=False, index=True)
    filename = Column(String, nullable=False)
    content_type = Column(String, nullable=True)
    size = Column(Integer, nullable=True)
    markdown_content = Column(Text, nullable=True)  # Converted to markdown
    raw_content_b64 = Column(Text, nullable=True)  # Base64-encoded raw content
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailAISummary(Base):
    """Model for storing AI-generated email summaries and suggested actions"""
    __tablename__ = "email_ai_summaries"

    id = Column(String, primary_key=True, index=True)
    email_id = Column(String, unique=True, nullable=False, index=True)
    summary = Column(Text, nullable=True)
    suggested_action = Column(String, nullable=True)  # e.g. "reply", "archive", "follow_up", "no_action"
    action_details = Column(Text, nullable=True)  # Detailed explanation of the suggested action
    needs_reply = Column(Boolean, nullable=False, default=False)
    priority = Column(String, nullable=True)  # "high", "medium", "low"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmailSuggestedReply(Base):
    """Model for storing AI-suggested reply drafts"""
    __tablename__ = "email_suggested_replies"

    id = Column(String, primary_key=True, index=True)
    email_id = Column(String, nullable=False, index=True)
    draft_content = Column(Text, nullable=False)
    tone = Column(String, nullable=True)  # "professional", "friendly", "brief"
    version = Column(Integer, nullable=False, default=1)
    is_final = Column(Boolean, nullable=False, default=False)  # User has approved
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
