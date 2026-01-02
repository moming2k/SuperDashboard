# Notification Center Plugin

A unified notification hub for SuperDashboard with intelligent filtering, custom rules, and multi-source integration.

## Features

### 🔔 Unified Notification Hub
- Centralized location for all notifications from multiple sources
- Real-time unread count badge
- Automatic polling every 30 seconds for new notifications
- Clean, organized display with filtering and sorting

### 🎯 Intelligent Filtering
- Filter by status (unread, read, archived)
- Filter by source (Jira, BitBucket, custom, system)
- Filter by priority (critical, high, medium, low)
- Filter by type (PR review, ticket assignment, comments, etc.)

### ⚙️ Custom Notification Rules
- Create rules with conditions and actions
- Automatically prioritize notifications based on criteria
- Enable/disable rules on the fly
- Flexible rule engine supports complex filtering logic

### 🔗 Multi-Source Integration
- **Jira Integration**: Automatic notifications for ticket assignments
- **BitBucket Integration**: PR review requests via webhooks
- **Custom Notifications**: API endpoint for custom integrations
- **Extensible**: Easy to add new notification sources

### 🎨 Priority System
- **Critical** 🔴: Urgent items requiring immediate attention
- **High** 🟠: Important items that should be addressed soon
- **Medium** 🟡: Regular notifications
- **Low** ⚪: Informational notifications

## API Endpoints

### Notifications

#### Get All Notifications
```
GET /plugins/notification-center/notifications
Query Parameters:
  - status: unread|read|archived
  - source: jira|bitbucket|custom|system
  - priority: critical|high|medium|low
  - type: pr_review|ticket_assignment|ticket_comment|etc.
  - limit: number (default: 100)
```

#### Create Notification
```
POST /plugins/notification-center/notifications
Body: {
  "title": "Notification Title",
  "description": "Optional description",
  "source": "jira",
  "priority": "high",
  "type": "ticket_assignment",
  "url": "https://link-to-item.com",
  "metadata": {
    "key": "value"
  }
}
```

#### Update Notification
```
PUT /plugins/notification-center/notifications/{id}
Body: {
  "status": "read",
  "priority": "high"
}
```

#### Delete Notification
```
DELETE /plugins/notification-center/notifications/{id}
```

#### Get Unread Count
```
GET /plugins/notification-center/notifications/unread-count
Response: { "count": 5 }
```

#### Mark All as Read
```
POST /plugins/notification-center/notifications/mark-all-read
```

#### Clear Read Notifications
```
POST /plugins/notification-center/notifications/clear-read
```

### Rules

#### Get All Rules
```
GET /plugins/notification-center/rules
```

#### Create Rule
```
POST /plugins/notification-center/rules
Body: {
  "name": "High Priority Jira Tickets",
  "description": "Set all Jira tickets as high priority",
  "enabled": true,
  "conditions": [
    {
      "field": "source",
      "operator": "equals",
      "value": "jira"
    }
  ],
  "actions": {
    "priority": "high"
  }
}
```

#### Update Rule
```
PUT /plugins/notification-center/rules/{id}
Body: { ...rule object }
```

#### Delete Rule
```
DELETE /plugins/notification-center/rules/{id}
```

### Integrations

#### Jira Issue Assignment
```
POST /plugins/notification-center/integrations/jira/issue-assigned
Body: {
  "key": "PROJ-123",
  "summary": "Issue summary",
  "type": "Bug",
  "assignee": "John Doe",
  "priority": "High",
  "url": "https://jira.com/browse/PROJ-123"
}
```

#### BitBucket Webhook
```
POST /plugins/notification-center/integrations/bitbucket/webhook
Body: { ...bitbucket webhook payload }
```

## Usage Examples

### Creating a Custom Notification

```javascript
const notification = {
  title: "Deployment Completed",
  description: "Production deployment finished successfully",
  source: "custom",
  priority: "medium",
  type: "custom",
  url: "https://deploy.example.com/123",
  metadata: {
    environment: "production",
    version: "1.2.3"
  }
};

await fetch('http://localhost:8000/plugins/notification-center/notifications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(notification)
});
```

### Creating a Rule

```javascript
const rule = {
  name: "Critical PR Reviews",
  description: "Automatically mark PR review requests as critical",
  enabled: true,
  conditions: [
    {
      field: "type",
      operator: "equals",
      value: "pr_review"
    },
    {
      field: "metadata.urgent",
      operator: "equals",
      value: "true"
    }
  ],
  actions: {
    priority: "critical"
  }
};

await fetch('http://localhost:8000/plugins/notification-center/rules', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(rule)
});
```

### Jira Integration

To enable automatic notifications when Jira issues are assigned, call the Jira issues endpoint with the `notify` flag:

```javascript
await fetch('http://localhost:8000/plugins/jira/issues?notify=true');
```

This will:
1. Fetch all Jira issues matching your JQL query
2. Create notifications for each assigned issue
3. Apply priority mapping based on Jira priority
4. Apply any matching notification rules

## Rule Engine

### Supported Operators

- `equals`: Exact match (case-insensitive)
- `contains`: Substring match (case-insensitive)
- `startswith`: Prefix match (case-insensitive)
- `not_equals`: Not equal (case-insensitive)

### Supported Actions

- `priority`: Set notification priority (low, medium, high, critical)
- `status`: Set notification status (unread, read, archived)

### Field Paths

You can use dot notation to access nested fields in metadata:

```javascript
{
  "field": "metadata.assignee",
  "operator": "equals",
  "value": "john.doe@example.com"
}
```

## Frontend Features

### Notification Display
- Visual indicators for unread notifications
- Priority icons and colors
- Source icons (Jira 🎫, BitBucket 📦, System ⚙️, Custom 📬)
- Type badges (PR Review, Ticket Assignment, etc.)
- Clickable links to original items
- Timestamp display

### Actions
- Mark individual notifications as read
- Delete individual notifications
- Mark all as read (bulk action)
- Clear all read notifications (bulk action)

### Rules Management
- Create new rules with a simple form
- Enable/disable rules without deleting
- Delete rules
- View rule conditions and actions

### Filtering
- Real-time filtering with dropdowns
- Multiple filter criteria simultaneously
- Filters persist during session
- Clear filters to show all

## Integration Guide

### Adding a New Notification Source

1. **Create a notification via API**:

```python
import httpx

async def send_notification(title, description, source, priority="medium"):
    async with httpx.AsyncClient() as client:
        notification = {
            "title": title,
            "description": description,
            "source": source,
            "priority": priority,
            "type": "custom",
            "metadata": {
                # Add any custom data
            }
        }
        response = await client.post(
            "http://localhost:8000/plugins/notification-center/notifications",
            json=notification
        )
        return response.json()
```

2. **Add webhook endpoint** (for external services):

```python
@router.post("/integrations/your-service/webhook")
async def your_service_webhook(payload: Dict[str, Any]):
    # Parse webhook payload
    # Create notification
    notification = Notification(
        title=payload.get('title'),
        description=payload.get('description'),
        source=NotificationSource.CUSTOM,
        type=NotificationType.CUSTOM,
        # ... other fields
    )
    await create_notification(notification)
```

### Environment Variables

No environment variables required. The plugin works out of the box.

For BitBucket webhooks, configure your BitBucket repository to send webhook events to:
```
http://your-server:8000/plugins/notification-center/integrations/bitbucket/webhook
```

## Data Models

### Notification

```typescript
{
  id: string,
  title: string,
  description?: string,
  source: "jira" | "bitbucket" | "custom" | "system",
  priority: "low" | "medium" | "high" | "critical",
  type: "pr_review" | "ticket_assignment" | "ticket_comment" | "pr_merged" | "custom",
  status: "unread" | "read" | "archived",
  created_at: string,
  url?: string,
  metadata: object
}
```

### Notification Rule

```typescript
{
  id: string,
  name: string,
  description?: string,
  enabled: boolean,
  conditions: [
    {
      field: string,
      operator: "equals" | "contains" | "startswith" | "not_equals",
      value: any
    }
  ],
  actions: {
    priority?: "low" | "medium" | "high" | "critical",
    status?: "unread" | "read" | "archived"
  },
  created_at: string
}
```

## Architecture

### Backend (`backend/main.py`)
- FastAPI router with all endpoints
- In-memory storage (replace with database for production)
- Rule engine with condition evaluation
- Integration endpoints for Jira and BitBucket
- Command palette integration

### Frontend (`frontend/NotificationCenter.jsx`)
- React functional component with hooks
- Real-time polling for updates
- Tabbed interface (Notifications / Rules)
- Advanced filtering UI
- Rule management interface

## Future Enhancements

- [ ] Database persistence (PostgreSQL)
- [ ] WebSocket support for real-time updates
- [ ] Email digest for unread notifications
- [ ] Slack/Teams integration
- [ ] Notification grouping and threading
- [ ] Advanced rule conditions (AND/OR logic)
- [ ] Notification templates
- [ ] User preferences and per-user notifications
- [ ] Snooze functionality
- [ ] Mobile push notifications

## Troubleshooting

### Notifications not appearing
1. Check that the plugin is loaded in the backend console
2. Verify API endpoint is reachable: `curl http://localhost:8000/plugins/notification-center/health`
3. Check browser console for frontend errors

### Jira notifications not working
1. Ensure Jira plugin is configured with credentials
2. Call `/plugins/jira/issues?notify=true` with the notify flag
3. Check backend logs for errors

### Rules not applying
1. Verify rule is enabled in the Rules tab
2. Check rule conditions match your notification fields
3. Test rule logic by examining notification metadata

## License

MIT License - See project root LICENSE file

## Support

For issues or feature requests, please file an issue on the SuperDashboard repository.
