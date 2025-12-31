# SuperDashboard Architecture Update - Micro-Portal System

**Date**: 2025-12-31
**Version**: 2.0

## Summary of Changes

SuperDashboard has been refactored to implement a **micro-portal architecture** where each plugin is a self-contained module with its own UI and logic, and `App.jsx` serves purely as a router.

## Key Improvements

### 1. Simplified App.jsx (295 lines → 221 lines)
- **Before**: App.jsx contained all UI logic for dashboard, tasks, and AI agent
- **After**: App.jsx is now a generic router that dynamically loads plugins
- **Benefit**: Adding new plugins requires ZERO changes to App.jsx

### 2. Core Plugins Architecture
All core functionality has been moved into plugins:

```
plugins/core/
├── dashboard/          # Welcome dashboard with stats
│   ├── frontend/
│   │   └── Dashboard.jsx
│   └── plugin.json
├── ai-agent/          # AI chat interface
│   ├── frontend/
│   │   └── AIAgent.jsx
│   └── plugin.json
└── tasks/             # Simple task manager
    ├── frontend/
    │   └── Tasks.jsx
    └── plugin.json
```

### 3. Enhanced Plugin Manifest Schema (v2.0)

**New manifest structure**:
```json
{
  "name": "plugin-name",
  "displayName": "Plugin Display Name",
  "description": "Plugin description",
  "version": "1.0.0",
  "tab": {
    "label": "Tab Label",
    "icon": "🎯",
    "order": 10,
    "enabled": true,
    "id": "custom-tab-id"
  },
  "replaces": "core-view-id",
  "frontendComponent": "ComponentName"
}
```

**Key features**:
- `tab.order`: Controls sidebar position (lower = higher)
- `tab.icon`: Emoji or icon class for visual identification
- `tab.enabled`: Show/hide tab without uninstalling plugin
- `replaces`: Replace core views (e.g., Jira replacing tasks)

### 4. Dynamic Tab Rendering

Tabs are now generated from plugin manifests:
- Automatically sorted by `order` field
- Plugins that replace core views hide the original
- No hardcoded tab lists in App.jsx

### 5. Frontend-Only Plugin Support

Plugins can now be frontend-only (no backend required):
- Only need `plugin.json` and frontend component
- Backend automatically detects and lists them
- Perfect for UI components, dashboards, visualizations

### 6. Inter-Plugin Communication

Plugins can navigate to other tabs using custom events:
```javascript
// From any plugin
window.dispatchEvent(new CustomEvent('navigate-tab', {
  detail: { tab: 'agent' }
}));
```

## Migration Guide

### For Plugin Developers

**Old manifest (v1.0)**:
```json
{
  "name": "my-plugin",
  "displayName": "My Plugin",
  "frontendComponent": "MyComponent"
}
```

**New manifest (v2.0)**:
```json
{
  "name": "my-plugin",
  "displayName": "My Plugin",
  "description": "What this plugin does",
  "version": "1.0.0",
  "tab": {
    "label": "My Plugin",
    "icon": "🔧",
    "order": 100,
    "enabled": true
  },
  "frontendComponent": "MyComponent"
}
```

### For Core Contributors

**Creating a new core plugin**:
1. Create directory: `plugins/core/my-feature/`
2. Add `plugin.json` with tab config (order 0-99 for core)
3. Add `frontend/MyComponent.jsx`
4. Create symlink: `cd frontend/src/plugins && ln -s ../../../plugins/core/my-feature/frontend my-feature`
5. Restart backend (frontend will hot-reload)

## Technical Details

### Backend Changes

**Plugin loading** (`backend/main.py`):
- Now scans `plugins/core/` for core plugins
- Supports frontend-only plugins (just needs `plugin.json`)
- Uses `load_plugin_from_path()` helper for reusability

**Plugin listing** (`/plugins` endpoint):
- Recursively scans plugin directories
- Returns manifest data for frontend routing
- Detects plugins with or without backend code

### Frontend Changes

**App.jsx**:
- `getVisibleTabs()`: Filters and sorts tabs by manifest
- `getActivePlugin()`: Finds plugin for current tab
- Listens for `navigate-tab` custom events
- Dynamic component loading with `.jsx` extension

**Component imports**:
```javascript
// Plugins use relative imports from symlink location
import Component from '../../components/Component';
```

## Benefits

### For Users
- Cleaner, more maintainable codebase
- Easier to understand what each plugin does
- Better visual organization with icons and ordering

### For Developers
- No need to modify App.jsx for new plugins
- Self-documenting via manifest schema
- Easier to create frontend-only plugins
- Better separation of concerns

### For System
- More scalable (can support 100+ plugins)
- Hot-reloadable frontend plugins
- Predictable tab ordering
- Graceful handling of replaced views

## File Changes Summary

**Modified**:
- `frontend/src/App.jsx` - Now a generic router
- `backend/main.py` - Enhanced plugin loading
- `plugins/jira/plugin.json` - Added tab config
- `plugins/whatsapp/plugin.json` - Added tab config

**Created**:
- `plugins/core/dashboard/` - Dashboard plugin
- `plugins/core/ai-agent/` - AI agent plugin
- `plugins/core/tasks/` - Tasks plugin
- `PLUGIN_MANIFEST_SCHEMA.md` - Schema documentation
- `frontend/src/plugins/{dashboard,ai-agent,tasks}` - Symlinks

**Removed**:
- None (fully backward compatible)

## Backward Compatibility

**Old plugins still work**:
- Plugins without tab config get default order (100)
- Missing icons default to 🧩
- Tab label defaults to `displayName` or `name`

**No breaking changes**:
- Existing plugins (Jira, WhatsApp) continue to function
- Old manifest format is supported
- Backend API unchanged

## Testing Checklist

- [x] Backend starts and loads all plugins
- [x] Frontend builds without errors
- [x] All plugins appear in /plugins endpoint
- [x] Tabs render in correct order
- [x] Core plugin replacement works (Jira replaces tasks)
- [x] Plugin navigation events work
- [x] Frontend-only plugins are detected

## Next Steps

1. **Documentation**: Update CLAUDE.md with new patterns
2. **Examples**: Create example plugins using new schema
3. **MCP Integration**: Add MCP server UI as a plugin
4. **Plugin Registry**: Build plugin discovery/marketplace
5. **Hot Reload**: Support backend plugin hot-reload

## Questions & Answers

**Q: Can I still create backend-only plugins?**
A: Yes! Just don't include `frontendComponent` in manifest and set `tab.enabled: false`.

**Q: How do I debug plugin loading?**
A: Check backend console for "Loaded router for plugin:" messages.

**Q: Can plugins communicate with each other?**
A: Yes, via custom events or shared localStorage (for now).

**Q: What's the recommended tab order range?**
A: 0-99 for core, 100-199 for user plugins, 200+ for experimental.

**Q: Can I have multiple tabs per plugin?**
A: Not yet - each plugin has one tab. You can have sub-navigation within the plugin.

---

**End of Architecture Update**
