# Plugin Badge Endpoint Schema

## Overview
Plugins can optionally expose a `/badge` endpoint to display additional information (counts, status, text) next to their tab label in the sidebar. The main framework polls these endpoints every 30 seconds and displays the badges.

## Endpoint Specification

### Endpoint
```
GET /plugins/{plugin_name}/badge
```

### Response Schema
```json
{
  "badge": {
    "type": "count" | "status" | "text",
    "value": string,
    "color": "primary" | "success" | "warning" | "error" | string,
    "tooltip": string (optional)
  }
}
```

### Badge Types

#### 1. Count Badge
Display a numeric counter (e.g., unread items, completed tasks).

**Example:**
```json
{
  "badge": {
    "type": "count",
    "value": "5",
    "color": "primary",
    "tooltip": "5 unread notifications"
  }
}
```

#### 2. Status Badge
Display a status indicator (colored dot).

**Example:**
```json
{
  "badge": {
    "type": "status",
    "value": "active",
    "color": "success",
    "tooltip": "System is running"
  }
}
```

#### 3. Text Badge
Display custom text.

**Example:**
```json
{
  "badge": {
    "type": "text",
    "value": "NEW",
    "color": "warning",
    "tooltip": "New features available"
  }
}
```

## Color Options

| Color | Usage | Example |
|-------|-------|---------|
| `primary` | Default, neutral information | Completed count |
| `success` | Positive status, completed items | Active status, success |
| `warning` | Attention needed, pending items | Warnings, pending |
| `error` | Critical status, errors | Errors, failures |
| Custom hex | Any custom color | `#FF5733` |

## Implementation Example

### Backend (FastAPI)
```python
@router.get("/badge")
async def get_badge(db: Session = Depends(get_db)):
    """Return badge information for the plugin tab"""
    try:
        # Get today's completed sessions
        today_sessions = db.query(PomodoroSession).filter(
            PomodoroSession.session_type == "work",
            PomodoroSession.completed == 1,
            PomodoroSession.created_at >= datetime.now().replace(hour=0, minute=0, second=0)
        ).count()
        
        return {
            "badge": {
                "type": "count",
                "value": str(today_sessions),
                "color": "primary",
                "tooltip": f"{today_sessions} Pomodoros completed today"
            }
        }
    except Exception as e:
        # Return empty badge on error
        return {"badge": None}
```

## Best Practices

1. **Performance**: Keep badge endpoint fast (< 100ms). Use database indexes and caching.
2. **Error Handling**: Return `{"badge": null}` on errors to gracefully degrade.
3. **Meaningful Values**: Ensure badge values are concise and meaningful.
4. **Tooltips**: Always provide tooltips for context.
5. **Color Consistency**: Use standard colors for consistent UX.
6. **Optional**: Badge endpoint is optional - plugins without badges work normally.

## Framework Integration

The main framework automatically:
- Discovers plugins with `/badge` endpoints
- Polls every 30 seconds (configurable)
- Displays badges next to tab labels
- Handles errors gracefully (skips failed plugins)
- Caches results to minimize backend load
