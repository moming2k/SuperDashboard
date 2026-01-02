# Plugin Commands Schema

## Overview

This document defines the standard for plugins to register commands with the Command Palette. Each plugin can expose a `/commands` endpoint that returns a list of executable commands.

## Command Schema

Each command should follow this JSON structure:

```json
{
  "id": "string (required, unique within plugin)",
  "label": "string (required, display name)",
  "description": "string (required, short description)",
  "category": "string (required, command category)",
  "icon": "string (required, emoji icon)",
  "endpoint": "string (optional, API endpoint path)",
  "method": "string (optional, HTTP method, defaults to 'POST')",
  "requiresInput": "boolean (optional, defaults to false)",
  "inputSchema": "object (optional, defines input fields)"
}
```

## Field Descriptions

### Required Fields

- **id**: Unique identifier within the plugin namespace (e.g., "refresh", "sync", "create-ticket")
  - Will be namespaced as `{plugin-name}.{id}` in the command palette
  - Must be lowercase, alphanumeric with hyphens

- **label**: Human-readable command name shown in the palette
  - Should start with plugin name or category (e.g., "Jira: Create Ticket")
  - Keep it concise (3-6 words)

- **description**: Brief explanation of what the command does
  - One sentence maximum
  - Focus on the outcome/benefit

- **category**: Grouping category for commands
  - Examples: "Jira", "RSS", "Git", "Build", "Test"
  - Used for filtering and visual organization

- **icon**: Single emoji representing the command
  - Makes commands visually scannable
  - Choose relevant emoji (e.g., 🎫 for tickets, 📰 for news)

### Optional Fields

- **endpoint**: API endpoint path relative to plugin base
  - Example: "/sync" will become `/plugins/{plugin-name}/sync`
  - If omitted, defaults to `/{command-id}`

- **method**: HTTP method for the endpoint
  - Defaults to "POST"
  - Use "GET" for read-only operations

- **requiresInput**: Whether command needs user input before execution
  - If true, Command Palette will show input dialog
  - Input fields defined in `inputSchema`

- **inputSchema**: Defines the input fields for the command
  - Array of field objects with `name`, `label`, `type`, `required`, `placeholder`
  - Supported types: "text", "textarea", "select"

## Input Schema Structure

```json
{
  "inputSchema": {
    "type": "form",
    "fields": [
      {
        "name": "string (field name)",
        "label": "string (display label)",
        "type": "text|textarea|select",
        "required": "boolean",
        "placeholder": "string (optional)",
        "options": ["array of options (for select type)"]
      }
    ]
  }
}
```

## Plugin Implementation

### 1. Add `/commands` Endpoint

Each plugin should expose a `/commands` endpoint that returns its available commands:

```python
from fastapi import APIRouter

router = APIRouter()

@router.get("/commands")
async def get_commands():
    """Return list of commands this plugin provides"""
    return {
        "commands": [
            {
                "id": "refresh",
                "label": "MyPlugin: Refresh Data",
                "description": "Fetch latest data from source",
                "category": "MyPlugin",
                "icon": "🔄",
                "endpoint": "/refresh",
                "method": "POST",
                "requiresInput": False
            },
            {
                "id": "search",
                "label": "MyPlugin: Search Items",
                "description": "Search through plugin data",
                "category": "MyPlugin",
                "icon": "🔍",
                "endpoint": "/search",
                "method": "GET",
                "requiresInput": True,
                "inputSchema": {
                    "type": "form",
                    "fields": [
                        {
                            "name": "query",
                            "label": "Search Query",
                            "type": "text",
                            "required": True,
                            "placeholder": "Enter search terms..."
                        }
                    ]
                }
            }
        ]
    }
```

### 2. Implement Command Endpoints

Create the actual endpoints that execute the commands:

```python
@router.post("/refresh")
async def refresh_data():
    """Execute refresh command"""
    # Your implementation here
    return {"success": True, "message": "Data refreshed"}

@router.get("/search")
async def search_items(query: str):
    """Execute search command"""
    # Your implementation here
    return {"success": True, "results": [...]}
```

## Command Palette Integration

The Command Palette plugin will:

1. Discover all plugins via `/plugins` endpoint
2. For each enabled plugin, fetch `/plugins/{plugin-name}/commands`
3. Merge all commands into a unified list
4. Namespace commands as `{plugin-name}.{command-id}`
5. Execute commands by routing to `{plugin-endpoint}/{command-endpoint}`

## Example: Complete Plugin Commands

### Jira Plugin Commands

```json
{
  "commands": [
    {
      "id": "create-ticket",
      "label": "Jira: Create Ticket",
      "description": "Create a new Jira issue",
      "category": "Jira",
      "icon": "🎫",
      "endpoint": "/create-ticket",
      "method": "POST",
      "requiresInput": true,
      "inputSchema": {
        "type": "form",
        "fields": [
          {
            "name": "project",
            "label": "Project Key",
            "type": "text",
            "required": true,
            "placeholder": "e.g., PROJ"
          },
          {
            "name": "summary",
            "label": "Summary",
            "type": "text",
            "required": true
          },
          {
            "name": "description",
            "label": "Description",
            "type": "textarea",
            "required": false
          },
          {
            "name": "issue_type",
            "label": "Issue Type",
            "type": "select",
            "required": true,
            "options": ["Task", "Bug", "Story"]
          }
        ]
      }
    },
    {
      "id": "sync-issues",
      "label": "Jira: Sync Issues",
      "description": "Fetch latest issues from Jira",
      "category": "Jira",
      "icon": "🔄",
      "endpoint": "/sync",
      "method": "POST",
      "requiresInput": false
    }
  ]
}
```

### RSS Reader Plugin Commands

```json
{
  "commands": [
    {
      "id": "fetch-feeds",
      "label": "RSS: Fetch All Feeds",
      "description": "Update all RSS feeds",
      "category": "RSS",
      "icon": "📰",
      "endpoint": "/fetch-all",
      "method": "POST",
      "requiresInput": false
    },
    {
      "id": "add-feed",
      "label": "RSS: Add Feed",
      "description": "Subscribe to a new RSS feed",
      "category": "RSS",
      "icon": "➕",
      "endpoint": "/add-feed",
      "method": "POST",
      "requiresInput": true,
      "inputSchema": {
        "type": "form",
        "fields": [
          {
            "name": "url",
            "label": "Feed URL",
            "type": "text",
            "required": true,
            "placeholder": "https://example.com/feed.xml"
          }
        ]
      }
    }
  ]
}
```

## Benefits

1. **Decentralization**: Each plugin manages its own commands
2. **Discoverability**: Commands are automatically available in Command Palette
3. **Consistency**: Standard schema ensures uniform UX
4. **Flexibility**: Plugins can add/remove commands without modifying core
5. **Type Safety**: Input schema provides validation and better UX

## Migration Path

For existing plugins:

1. Add `/commands` endpoint to plugin's backend router
2. Define commands following the schema above
3. Ensure command endpoints are implemented
4. Command Palette will auto-discover on next plugin load

## Future Extensions

- **Keyboard Shortcuts**: Allow plugins to define custom shortcuts
- **Command Chaining**: Support sequential command execution
- **Conditional Commands**: Show/hide based on app state
- **Command Validation**: Pre-execution validation rules
- **Command History**: Track and suggest recent commands
