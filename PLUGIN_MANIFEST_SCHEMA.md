# Plugin Manifest Schema v2.0

## Overview
This schema defines how plugins register themselves with SuperDashboard, including tab configuration for the micro-portal architecture.

## Schema Definition

```json
{
  "name": "string (required)",
  "displayName": "string (optional)",
  "description": "string (optional)",
  "version": "string (optional)",

  "tab": {
    "label": "string (required)",
    "icon": "string (optional, emoji or icon class)",
    "order": "number (optional, default: 100)",
    "enabled": "boolean (optional, default: true)",
    "id": "string (optional, defaults to plugin name)"
  },

  "replaces": "string (optional, ID of core view to replace)",
  "frontendComponent": "string (required if has frontend)",

  "backend": {
    "enabled": "boolean (optional, default: true)",
    "mountPath": "string (optional, defaults to /plugins/{name})"
  }
}
```

## Field Descriptions

### Core Fields
- **name**: Unique plugin identifier (must match directory name)
- **displayName**: Human-readable name shown in UI
- **description**: Brief description of plugin functionality
- **version**: Semantic version (e.g., "1.0.0")

### Tab Configuration
- **tab.label**: Text shown in sidebar navigation
- **tab.icon**: Emoji or icon class to display before label
- **tab.order**: Determines sidebar position (lower = higher up)
  - Core plugins: 0-99
  - User plugins: 100+
- **tab.enabled**: Whether to show tab in sidebar
- **tab.id**: Custom tab ID (defaults to plugin name)

### Component Configuration
- **replaces**: Core view ID to replace (e.g., "tasks", "dashboard")
  - When set, plugin replaces the core view entirely
  - Original view is hidden from sidebar
- **frontendComponent**: React component filename (without .jsx)
  - Must be in `plugins/{name}/frontend/` directory

### Backend Configuration
- **backend.enabled**: Whether plugin has backend endpoints
- **backend.mountPath**: Custom API path (default: `/plugins/{name}`)

## Core View IDs

The following core views can be replaced:
- `dashboard` - Main dashboard view
- `tasks` - Task management view
- `agent` - AI chat interface
- `plugins` - Plugin registry view

## Examples

### Simple Plugin (Frontend Only)
```json
{
  "name": "calculator",
  "displayName": "Calculator",
  "tab": {
    "label": "Calculator",
    "icon": "🧮",
    "order": 50
  },
  "frontendComponent": "Calculator"
}
```

### Plugin Replacing Core View
```json
{
  "name": "jira",
  "displayName": "Jira Integration",
  "tab": {
    "label": "Jira Tasks",
    "icon": "🏷️",
    "order": 20
  },
  "replaces": "tasks",
  "frontendComponent": "JiraTasks"
}
```

### Backend-Only Plugin (No Tab)
```json
{
  "name": "auth-service",
  "displayName": "Authentication Service",
  "tab": {
    "enabled": false
  },
  "backend": {
    "enabled": true
  }
}
```

### Full-Featured Plugin
```json
{
  "name": "whatsapp",
  "displayName": "WhatsApp AI Agent",
  "description": "Twilio-powered WhatsApp integration with AI responses",
  "version": "1.0.0",
  "tab": {
    "label": "WhatsApp AI",
    "icon": "💬",
    "order": 30,
    "enabled": true
  },
  "frontendComponent": "WhatsAppChat",
  "backend": {
    "enabled": true,
    "mountPath": "/plugins/whatsapp"
  }
}
```

## Migration from v1.0

### Old Schema
```json
{
  "name": "jira",
  "displayName": "Jira Integration",
  "replaces": "tasks",
  "frontendComponent": "JiraTasks"
}
```

### New Schema (Backward Compatible)
```json
{
  "name": "jira",
  "displayName": "Jira Integration",
  "tab": {
    "label": "Jira Integration",
    "icon": "🏷️",
    "order": 100
  },
  "replaces": "tasks",
  "frontendComponent": "JiraTasks"
}
```

## Default Behavior

If fields are omitted:
- `tab.label` defaults to `displayName` or `name`
- `tab.icon` defaults to "🧩"
- `tab.order` defaults to 100
- `tab.enabled` defaults to `true` if `frontendComponent` exists
- `backend.enabled` defaults to `true` if backend router exists
