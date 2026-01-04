from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
from enum import Enum
import uuid
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
from plugins.shared.database import get_db, init_db

# Import database models - use direct import to avoid module name issues
import importlib.util
spec = importlib.util.spec_from_file_location(
    "notification_db",
    os.path.join(os.path.dirname(__file__), "database.py")
)
notification_db_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(notification_db_module)
DBNotification = notification_db_module.Notification
DBNotificationRule = notification_db_module.NotificationRule

router = APIRouter()

# Initialize database tables on module load
try:
    init_db()
    print("🔔 Notification Center database tables initialized")
except Exception as e:
    print(f"⚠️  Notification Center database initialization warning: {e}")

# Enums for notification attributes
class NotificationPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class NotificationSource(str, Enum):
    JIRA = "jira"
    BITBUCKET = "bitbucket"
    CUSTOM = "custom"
    SYSTEM = "system"

class NotificationType(str, Enum):
    PR_REVIEW = "pr_review"
    TICKET_ASSIGNMENT = "ticket_assignment"
    TICKET_COMMENT = "ticket_comment"
    TICKET_STATUS_CHANGE = "ticket_status_change"
    PR_COMMENT = "pr_comment"
    PR_MERGED = "pr_merged"
    CUSTOM = "custom"

class NotificationStatus(str, Enum):
    UNREAD = "unread"
    READ = "read"
    ARCHIVED = "archived"

# Pydantic Models
class Notification(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    source: NotificationSource
    priority: NotificationPriority = NotificationPriority.MEDIUM
    type: NotificationType
    status: NotificationStatus = NotificationStatus.UNREAD
    created_at: Optional[str] = None
    url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}

class NotificationUpdate(BaseModel):
    status: Optional[NotificationStatus] = None
    priority: Optional[NotificationPriority] = None

class RuleCondition(BaseModel):
    field: str  # e.g., "source", "type", "metadata.assignee"
    operator: str  # e.g., "equals", "contains", "startswith"
    value: Any

class NotificationRule(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    enabled: bool = True
    conditions: List[RuleCondition]
    actions: Dict[str, Any]  # e.g., {"priority": "high", "notify": true}
    created_at: Optional[str] = None

# Database storage (migrated from in-memory)

# Helper function to evaluate rule conditions
def evaluate_condition(notification: Notification, condition: RuleCondition) -> bool:
    """Evaluate if a notification matches a rule condition"""
    # Get the field value from notification
    field_parts = condition.field.split('.')
    value = notification.dict()

    try:
        for part in field_parts:
            value = value.get(part)
            if value is None:
                return False

        # Evaluate operator
        if condition.operator == "equals":
            return str(value).lower() == str(condition.value).lower()
        elif condition.operator == "contains":
            return str(condition.value).lower() in str(value).lower()
        elif condition.operator == "startswith":
            return str(value).lower().startswith(str(condition.value).lower())
        elif condition.operator == "not_equals":
            return str(value).lower() != str(condition.value).lower()
        else:
            return False
    except Exception:
        return False

def apply_rules(notification: Notification, db: Session) -> Notification:
    """Apply all enabled rules to a notification"""
    rules = db.query(DBNotificationRule).filter(DBNotificationRule.enabled == True).all()
    
    for db_rule in rules:
        # Convert DB rule to Pydantic model for evaluation
        rule = NotificationRule(
            id=db_rule.id,
            name=db_rule.name,
            description=db_rule.description,
            enabled=db_rule.enabled,
            conditions=[RuleCondition(**c) for c in db_rule.conditions],
            actions=db_rule.actions,
            created_at=db_rule.created_at.isoformat() if db_rule.created_at else None
        )
        
        # Check if all conditions match
        all_conditions_match = all(
            evaluate_condition(notification, condition)
            for condition in rule.conditions
        )

        if all_conditions_match:
            # Apply actions
            if "priority" in rule.actions:
                notification.priority = NotificationPriority(rule.actions["priority"])
            if "status" in rule.actions:
                notification.status = NotificationStatus(rule.actions["status"])
            # Add more actions as needed

    return notification

# Notification Endpoints
@router.get("/notifications")
async def get_notifications(
    status: Optional[str] = None,
    source: Optional[str] = None,
    priority: Optional[str] = None,
    type: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all notifications with optional filtering"""
    query = db.query(DBNotification)

    # Apply filters
    if status:
        query = query.filter(DBNotification.status == status)
    if source:
        query = query.filter(DBNotification.source == source)
    if priority:
        query = query.filter(DBNotification.priority == priority)
    if type:
        query = query.filter(DBNotification.type == type)

    # Sort by created_at (newest first) and limit
    notifications = query.order_by(DBNotification.created_at.desc()).limit(limit).all()
    
    return [{
        "id": n.id,
        "title": n.title,
        "description": n.description,
        "source": n.source,
        "priority": n.priority,
        "type": n.type,
        "status": n.status,
        "url": n.url,
        "metadata": n.notification_metadata,
        "created_at": n.created_at.isoformat() if n.created_at else None
    } for n in notifications]

@router.post("/notifications", response_model=Dict[str, Any])
async def create_notification(notification: Notification, db: Session = Depends(get_db)):
    """Create a new notification"""
    notification.id = str(uuid.uuid4())
    notification.created_at = datetime.utcnow().isoformat()

    # Apply rules before saving
    notification = apply_rules(notification, db)

    db_notification = DBNotification(
        id=notification.id,
        title=notification.title,
        description=notification.description,
        source=notification.source,
        priority=notification.priority,
        type=notification.type,
        status=notification.status,
        url=notification.url,
        metadata=notification.notification_metadata or {},
        created_at=datetime.utcnow()
    )
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    
    return {
        "id": db_notification.id,
        "title": db_notification.title,
        "description": db_notification.description,
        "source": db_notification.source,
        "priority": db_notification.priority,
        "type": db_notification.type,
        "status": db_notification.status,
        "url": db_notification.url,
        "metadata": db_notification.notification_metadata,
        "created_at": db_notification.created_at.isoformat() if db_notification.created_at else None
    }

@router.put("/notifications/{notification_id}")
async def update_notification(notification_id: str, update: NotificationUpdate, db: Session = Depends(get_db)):
    """Update a notification (e.g., mark as read)"""
    notification = db.query(DBNotification).filter(DBNotification.id == notification_id).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if update.status:
        notification.status = update.status
    if update.priority:
        notification.priority = update.priority

    db.commit()
    db.refresh(notification)
    
    return {
        "id": notification.id,
        "title": notification.title,
        "description": notification.description,
        "source": notification.source,
        "priority": notification.priority,
        "type": notification.type,
        "status": notification.status,
        "url": notification.url,
        "metadata": notification.notification_metadata,
        "created_at": notification.created_at.isoformat() if notification.created_at else None
    }

@router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str, db: Session = Depends(get_db)):
    """Delete a notification"""
    notification = db.query(DBNotification).filter(DBNotification.id == notification_id).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notification)
    db.commit()
    return {"message": "Notification deleted"}

@router.get("/notifications/unread-count")
async def get_unread_count(db: Session = Depends(get_db)):
    """Get count of unread notifications"""
    unread_count = db.query(DBNotification).filter(DBNotification.status == "unread").count()
    return {"count": unread_count}

@router.post("/notifications/mark-all-read")
async def mark_all_read(db: Session = Depends(get_db)):
    """Mark all notifications as read"""
    db.query(DBNotification).filter(DBNotification.status == "unread").update({"status": "read"})
    db.commit()
    return {"message": "All notifications marked as read"}

@router.post("/notifications/clear-read")
async def clear_read(db: Session = Depends(get_db)):
    """Clear all read notifications"""
    deleted_count = db.query(DBNotification).filter(DBNotification.status == "read").delete()
    db.commit()
    return {"message": f"Cleared {deleted_count} read notifications"}

# Rule Endpoints
@router.get("/rules")
async def get_rules(db: Session = Depends(get_db)):
    """Get all notification rules"""
    rules = db.query(DBNotificationRule).all()
    return [{
        "id": r.id,
        "name": r.name,
        "description": r.description,
        "enabled": r.enabled,
        "conditions": r.conditions,
        "actions": r.actions,
        "created_at": r.created_at.isoformat() if r.created_at else None
    } for r in rules]

@router.post("/rules")
async def create_rule(rule: NotificationRule, db: Session = Depends(get_db)):
    """Create a new notification rule"""
    rule.id = str(uuid.uuid4())
    rule.created_at = datetime.utcnow().isoformat()
    
    db_rule = DBNotificationRule(
        id=rule.id,
        name=rule.name,
        description=rule.description,
        enabled=rule.enabled,
        conditions=[c.dict() for c in rule.conditions],
        actions=rule.actions,
        created_at=datetime.utcnow()
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    
    return {
        "id": db_rule.id,
        "name": db_rule.name,
        "description": db_rule.description,
        "enabled": db_rule.enabled,
        "conditions": db_rule.conditions,
        "actions": db_rule.actions,
        "created_at": db_rule.created_at.isoformat() if db_rule.created_at else None
    }

@router.put("/rules/{rule_id}")
async def update_rule(rule_id: str, updated_rule: NotificationRule, db: Session = Depends(get_db)):
    """Update a notification rule"""
    rule = db.query(DBNotificationRule).filter(DBNotificationRule.id == rule_id).first()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.name = updated_rule.name
    rule.description = updated_rule.description
    rule.enabled = updated_rule.enabled
    rule.conditions = [c.dict() for c in updated_rule.conditions]
    rule.actions = updated_rule.actions

    db.commit()
    db.refresh(rule)
    
    return {
        "id": rule.id,
        "name": rule.name,
        "description": rule.description,
        "enabled": rule.enabled,
        "conditions": rule.conditions,
        "actions": rule.actions,
        "created_at": rule.created_at.isoformat() if rule.created_at else None
    }

@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str, db: Session = Depends(get_db)):
    """Delete a notification rule"""
    rule = db.query(DBNotificationRule).filter(DBNotificationRule.id == rule_id).first()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    db.delete(rule)
    db.commit()
    return {"message": "Rule deleted"}

# BitBucket Integration
@router.post("/integrations/bitbucket/webhook")
async def bitbucket_webhook(payload: Dict[str, Any]):
    """Handle BitBucket webhook events"""
    event_type = payload.get("eventKey", "")

    if "pullrequest:created" in event_type or "pullrequest:updated" in event_type:
        pr_data = payload.get("pullrequest", {})
        reviewers = pr_data.get("reviewers", [])

        # Create notification for each reviewer
        for reviewer in reviewers:
            notification = Notification(
                title=f"PR Review Needed: {pr_data.get('title', 'Untitled')}",
                description=f"You've been requested to review a pull request",
                source=NotificationSource.BITBUCKET,
                type=NotificationType.PR_REVIEW,
                priority=NotificationPriority.MEDIUM,
                url=pr_data.get("links", {}).get("html", {}).get("href"),
                metadata={
                    "pr_id": pr_data.get("id"),
                    "author": pr_data.get("author", {}).get("display_name"),
                    "reviewer": reviewer.get("display_name")
                }
            )
            await create_notification(notification)

    return {"message": "Webhook processed"}

# Jira Integration Helper Endpoint
@router.post("/integrations/jira/issue-assigned")
async def jira_issue_assigned(issue_data: Dict[str, Any]):
    """Create notification when a Jira issue is assigned"""
    notification = Notification(
        title=f"Jira Ticket Assigned: {issue_data.get('key', '')}",
        description=issue_data.get('summary', ''),
        source=NotificationSource.JIRA,
        type=NotificationType.TICKET_ASSIGNMENT,
        priority=NotificationPriority.MEDIUM,
        url=issue_data.get('url'),
        metadata={
            "issue_key": issue_data.get('key'),
            "issue_type": issue_data.get('type'),
            "assignee": issue_data.get('assignee'),
            "priority": issue_data.get('priority')
        }
    )

    # Apply priority mapping from Jira priority
    jira_priority = issue_data.get('priority', '').lower()
    if jira_priority in ['highest', 'critical']:
        notification.priority = NotificationPriority.CRITICAL
    elif jira_priority == 'high':
        notification.priority = NotificationPriority.HIGH
    elif jira_priority == 'low':
        notification.priority = NotificationPriority.LOW

    return await create_notification(notification)

# Command Palette Integration
@router.get("/commands")
async def get_commands():
    """Return commands that this plugin provides to the Command Palette"""
    return {
        "commands": [
            {
                "id": "view-notifications",
                "label": "Notifications: View All",
                "description": "Open notification center",
                "category": "Notifications",
                "icon": "🔔",
                "endpoint": "/notifications",
                "method": "GET",
                "requiresInput": False
            },
            {
                "id": "mark-all-read",
                "label": "Notifications: Mark All Read",
                "description": "Mark all notifications as read",
                "category": "Notifications",
                "icon": "✓",
                "endpoint": "/notifications/mark-all-read",
                "method": "POST",
                "requiresInput": False
            },
            {
                "id": "clear-read",
                "label": "Notifications: Clear Read",
                "description": "Delete all read notifications",
                "category": "Notifications",
                "icon": "🗑️",
                "endpoint": "/notifications/clear-read",
                "method": "POST",
                "requiresInput": False
            },
            {
                "id": "create-rule",
                "label": "Notifications: Create Rule",
                "description": "Create a new notification filtering rule",
                "category": "Notifications",
                "icon": "⚙️",
                "endpoint": "/rules",
                "method": "POST",
                "requiresInput": True,
                "inputSchema": {
                    "type": "form",
                    "fields": [
                        {
                            "name": "name",
                            "label": "Rule Name",
                            "type": "text",
                            "required": True,
                            "placeholder": "High Priority Jira Tickets"
                        },
                        {
                            "name": "description",
                            "label": "Description",
                            "type": "text",
                            "required": False,
                            "placeholder": "Set Jira tickets as high priority"
                        }
                    ]
                }
            }
        ]
    }

@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint"""
    notifications_count = db.query(DBNotification).count()
    rules_count = db.query(DBNotificationRule).count()
    return {
        "status": "healthy",
        "notifications_count": notifications_count,
        "rules_count": rules_count
    }
