from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid

router = APIRouter()

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

# In-memory storage (replace with database in production)
notifications_db: List[Notification] = []
rules_db: List[NotificationRule] = []

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

def apply_rules(notification: Notification) -> Notification:
    """Apply all enabled rules to a notification"""
    for rule in rules_db:
        if not rule.enabled:
            continue

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
    limit: int = 100
):
    """Get all notifications with optional filtering"""
    filtered_notifications = notifications_db.copy()

    # Apply filters
    if status:
        filtered_notifications = [n for n in filtered_notifications if n.status == status]
    if source:
        filtered_notifications = [n for n in filtered_notifications if n.source == source]
    if priority:
        filtered_notifications = [n for n in filtered_notifications if n.priority == priority]
    if type:
        filtered_notifications = [n for n in filtered_notifications if n.type == type]

    # Sort by created_at (newest first) and limit
    filtered_notifications.sort(key=lambda x: x.created_at or "", reverse=True)
    return filtered_notifications[:limit]

@router.post("/notifications", response_model=Notification)
async def create_notification(notification: Notification):
    """Create a new notification"""
    notification.id = str(uuid.uuid4())
    notification.created_at = datetime.utcnow().isoformat()

    # Apply rules before saving
    notification = apply_rules(notification)

    notifications_db.append(notification)
    return notification

@router.put("/notifications/{notification_id}", response_model=Notification)
async def update_notification(notification_id: str, update: NotificationUpdate):
    """Update a notification (e.g., mark as read)"""
    notification = next((n for n in notifications_db if n.id == notification_id), None)

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if update.status:
        notification.status = update.status
    if update.priority:
        notification.priority = update.priority

    return notification

@router.delete("/notifications/{notification_id}")
async def delete_notification(notification_id: str):
    """Delete a notification"""
    global notifications_db
    notification = next((n for n in notifications_db if n.id == notification_id), None)

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notifications_db = [n for n in notifications_db if n.id != notification_id]
    return {"message": "Notification deleted"}

@router.get("/notifications/unread-count")
async def get_unread_count():
    """Get count of unread notifications"""
    unread_count = len([n for n in notifications_db if n.status == NotificationStatus.UNREAD])
    return {"count": unread_count}

@router.post("/notifications/mark-all-read")
async def mark_all_read():
    """Mark all notifications as read"""
    for notification in notifications_db:
        if notification.status == NotificationStatus.UNREAD:
            notification.status = NotificationStatus.READ
    return {"message": "All notifications marked as read"}

@router.post("/notifications/clear-read")
async def clear_read():
    """Clear all read notifications"""
    global notifications_db
    before_count = len(notifications_db)
    notifications_db = [n for n in notifications_db if n.status != NotificationStatus.READ]
    cleared_count = before_count - len(notifications_db)
    return {"message": f"Cleared {cleared_count} read notifications"}

# Rule Endpoints
@router.get("/rules")
async def get_rules():
    """Get all notification rules"""
    return rules_db

@router.post("/rules", response_model=NotificationRule)
async def create_rule(rule: NotificationRule):
    """Create a new notification rule"""
    rule.id = str(uuid.uuid4())
    rule.created_at = datetime.utcnow().isoformat()
    rules_db.append(rule)
    return rule

@router.put("/rules/{rule_id}", response_model=NotificationRule)
async def update_rule(rule_id: str, updated_rule: NotificationRule):
    """Update a notification rule"""
    rule = next((r for r in rules_db if r.id == rule_id), None)

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.name = updated_rule.name
    rule.description = updated_rule.description
    rule.enabled = updated_rule.enabled
    rule.conditions = updated_rule.conditions
    rule.actions = updated_rule.actions

    return rule

@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str):
    """Delete a notification rule"""
    global rules_db
    rule = next((r for r in rules_db if r.id == rule_id), None)

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rules_db = [r for r in rules_db if r.id != rule_id]
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
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "notifications_count": len(notifications_db),
        "rules_count": len(rules_db)
    }
