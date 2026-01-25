"""
Service layer for database operations
Provides clean interface for database interactions with dependency injection
"""
from typing import List, Optional, Dict, Any
import uuid
from sqlalchemy.orm import Session
from database import Task, MCPServer, PluginState, PluginOrder, SystemConfig, DashboardLayout, Suite, UserSuiteSelection


# ==================== Task Services ====================

def get_tasks(db: Session) -> List[Task]:
    """Get all tasks"""
    return db.query(Task).order_by(Task.created_at.desc()).all()


def get_task_by_id(db: Session, task_id: str) -> Optional[Task]:
    """Get a task by ID"""
    return db.query(Task).filter(Task.id == task_id).first()


def create_task(db: Session, task_id: str, title: str, description: Optional[str] = None,
                status: str = "pending", priority: str = "medium", due_date: Optional[Any] = None,
                assigned_to: Optional[str] = "user") -> Task:
    """Create a new task"""
    db_task = Task(
        id=task_id,
        title=title,
        description=description,
        status=status,
        priority=priority,
        due_date=due_date,
        assigned_to=assigned_to
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def update_task(db: Session, task_id: str, **kwargs) -> Optional[Task]:
    """Update a task"""
    db_task = get_task_by_id(db, task_id)
    if not db_task:
        return None

    for key, value in kwargs.items():
        if hasattr(db_task, key):
            setattr(db_task, key, value)

    db.commit()
    db.refresh(db_task)
    return db_task


def delete_task(db: Session, task_id: str) -> bool:
    """Delete a task"""
    db_task = get_task_by_id(db, task_id)
    if not db_task:
        return False

    db.delete(db_task)
    db.commit()
    return True


# ==================== MCP Server Services ====================

def get_mcp_servers(db: Session) -> List[MCPServer]:
    """Get all MCP servers"""
    return db.query(MCPServer).all()


def get_mcp_server_by_name(db: Session, name: str) -> Optional[MCPServer]:
    """Get MCP server by name"""
    return db.query(MCPServer).filter(MCPServer.name == name).first()


def create_mcp_server(db: Session, name: str, url: str, api_key: Optional[str] = None,
                     status: str = "disconnected") -> MCPServer:
    """Create a new MCP server"""
    db_server = MCPServer(
        name=name,
        url=url,
        api_key=api_key,
        status=status
    )
    db.add(db_server)
    db.commit()
    db.refresh(db_server)
    return db_server


def update_mcp_server(db: Session, name: str, **kwargs) -> Optional[MCPServer]:
    """Update MCP server"""
    db_server = get_mcp_server_by_name(db, name)
    if not db_server:
        return None

    for key, value in kwargs.items():
        if hasattr(db_server, key):
            setattr(db_server, key, value)

    db.commit()
    db.refresh(db_server)
    return db_server


def delete_mcp_server(db: Session, name: str) -> bool:
    """Delete MCP server"""
    db_server = get_mcp_server_by_name(db, name)
    if not db_server:
        return False

    db.delete(db_server)
    db.commit()
    return True


# ==================== Plugin State Services ====================

def get_plugin_state(db: Session, plugin_name: str) -> Optional[PluginState]:
    """Get plugin state"""
    return db.query(PluginState).filter(PluginState.plugin_name == plugin_name).first()


def get_all_plugin_states(db: Session) -> List[PluginState]:
    """Get all plugin states"""
    return db.query(PluginState).all()


def is_plugin_enabled(db: Session, plugin_name: str, is_core: bool = False) -> bool:
    """Check if plugin is enabled. Core plugins are always enabled."""
    if is_core:
        return True

    state = get_plugin_state(db, plugin_name)
    return state.enabled if state else True  # Default to enabled


def get_plugin_config(db: Session, plugin_name: str) -> Dict[str, Any]:
    """Get plugin configuration"""
    state = get_plugin_state(db, plugin_name)
    return state.config if state and state.config else {}


def set_plugin_enabled(db: Session, plugin_name: str, enabled: bool, is_core: bool = False) -> PluginState:
    """Set plugin enabled state"""
    state = get_plugin_state(db, plugin_name)

    if state:
        state.enabled = enabled
        state.is_core = is_core
    else:
        state = PluginState(
            plugin_name=plugin_name,
            enabled=enabled,
            is_core=is_core,
            config={}
        )
        db.add(state)

    db.commit()
    db.refresh(state)
    return state


def set_plugin_config(db: Session, plugin_name: str, config: Dict[str, Any]) -> PluginState:
    """Set plugin configuration"""
    state = get_plugin_state(db, plugin_name)

    if state:
        state.config = config
    else:
        state = PluginState(
            plugin_name=plugin_name,
            enabled=True,
            is_core=False,
            config=config
        )
        db.add(state)

    db.commit()
    db.refresh(state)
    return state


# ==================== Plugin Order Services ====================

def get_plugin_order(db: Session, plugin_name: str) -> Optional[int]:
    """Get plugin order index"""
    order_entry = db.query(PluginOrder).filter(PluginOrder.plugin_name == plugin_name).first()
    return order_entry.order_index if order_entry else None


def set_plugin_order(db: Session, plugin_name: str, order_index: int) -> PluginOrder:
    """Set plugin order index"""
    order_entry = db.query(PluginOrder).filter(PluginOrder.plugin_name == plugin_name).first()

    if order_entry:
        order_entry.order_index = order_index
    else:
        order_entry = PluginOrder(plugin_name=plugin_name, order_index=order_index)
        db.add(order_entry)

    db.commit()
    db.refresh(order_entry)
    return order_entry


# ==================== System Config Services ====================

def get_system_config(db: Session, key: str) -> Optional[Any]:
    """Get system configuration value"""
    config = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    return config.value if config else None


def set_system_config(db: Session, key: str, value: Any) -> SystemConfig:
    """Set system configuration value"""
    config = db.query(SystemConfig).filter(SystemConfig.key == key).first()

    if config:
        config.value = value
    else:
        config = SystemConfig(key=key, value=value)
        db.add(config)

    db.commit()
    db.refresh(config)
    return config


def get_mcp_enabled(db: Session) -> bool:
    """Get MCP enabled status"""
    value = get_system_config(db, "mcp_enabled")
    return value if value is not None else False


def set_mcp_enabled(db: Session, enabled: bool) -> SystemConfig:
    """Set MCP enabled status"""
    return set_system_config(db, "mcp_enabled", enabled)


# ==================== Dashboard Layout Services ====================

def get_dashboard_layout(db: Session, user_id: str = "default") -> Optional[List[Dict[str, Any]]]:
    """Get user's dashboard layout"""
    layout_entry = db.query(DashboardLayout).filter(DashboardLayout.user_id == user_id).first()
    return layout_entry.layout if layout_entry else None


def set_dashboard_layout(db: Session, layout: List[Dict[str, Any]], user_id: str = "default") -> DashboardLayout:
    """Set user's dashboard layout"""
    layout_entry = db.query(DashboardLayout).filter(DashboardLayout.user_id == user_id).first()

    if layout_entry:
        layout_entry.layout = layout
    else:
        layout_entry = DashboardLayout(user_id=user_id, layout=layout)
        db.add(layout_entry)

    db.commit()
    db.refresh(layout_entry)
    return layout_entry

# ==================== Snippet Services ====================

def get_snippets(db: Session, visibility: Optional[str] = None, language: Optional[str] = None,
                 tag: Optional[str] = None, search: Optional[str] = None, favorite: Optional[bool] = None,
                 sort_by: str = "updated_at", limit: int = 100) -> List:
    """Get snippets with optional filtering"""
    from database import Snippet
    query = db.query(Snippet)
    
    # Apply filters
    if visibility:
        query = query.filter(Snippet.visibility == visibility)
    if language:
        query = query.filter(Snippet.language == language)
    if tag:
        query = query.filter(Snippet.tags.contains([tag]))
    if search:
        search_pattern = f"%{search.lower()}%"
        query = query.filter(
            (Snippet.title.ilike(search_pattern)) |
            (Snippet.description.ilike(search_pattern)) |
            (Snippet.code.ilike(search_pattern))
        )
    if favorite is not None:
        query = query.filter(Snippet.favorite == favorite)
    
    # Sort
    if sort_by == "updated_at":
        query = query.order_by(Snippet.updated_at.desc())
    elif sort_by == "created_at":
        query = query.order_by(Snippet.created_at.desc())
    elif sort_by == "title":
        query = query.order_by(Snippet.title)
    elif sort_by == "use_count":
        query = query.order_by(Snippet.use_count.desc())
    
    return query.limit(limit).all()


def get_snippet_by_id(db: Session, snippet_id: str):
    """Get a specific snippet by ID"""
    from database import Snippet
    return db.query(Snippet).filter(Snippet.id == snippet_id).first()


def create_snippet(db: Session, snippet_id: str, title: str, code: str, language: str,
                   description: Optional[str] = None, visibility: str = "personal",
                   tags: List[str] = [], created_by: Optional[str] = "current_user",
                   favorite: bool = False):
    """Create a new snippet"""
    from database import Snippet
    from datetime import datetime
    
    db_snippet = Snippet(
        id=snippet_id,
        title=title,
        description=description,
        code=code,
        language=language,
        visibility=visibility,
        tags=tags,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        created_by=created_by,
        favorite=favorite,
        use_count=0
    )
    
    # Update tag counts
    for tag_name in tags:
        update_tag_count(db, tag_name, increment=True)
    
    db.add(db_snippet)
    db.commit()
    db.refresh(db_snippet)
    return db_snippet


def update_snippet(db: Session, snippet_id: str, **kwargs):
    """Update a snippet"""
    from datetime import datetime
    db_snippet = get_snippet_by_id(db, snippet_id)
    if not db_snippet:
        return None
    
    old_tags = db_snippet.tags.copy() if db_snippet.tags else []
    
    # Create version if code is changing
    if 'code' in kwargs and kwargs['code'] and kwargs['code'] != db_snippet.code:
        create_snippet_version(db, db_snippet)
    
    # Update fields
    for key, value in kwargs.items():
        if hasattr(db_snippet, key) and value is not None:
            setattr(db_snippet, key, value)
    
    # Update tag counts if tags changed
    if 'tags' in kwargs:
        new_tags = kwargs['tags'] or []
        for tag in old_tags:
            if tag not in new_tags:
                update_tag_count(db, tag, increment=False)
        for tag in new_tags:
            if tag not in old_tags:
                update_tag_count(db, tag, increment=True)
    
    db_snippet.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_snippet)
    return db_snippet


def delete_snippet(db: Session, snippet_id: str) -> bool:
    """Delete a snippet"""
    db_snippet = get_snippet_by_id(db, snippet_id)
    if not db_snippet:
        return False
    
    # Update tag counts
    for tag_name in db_snippet.tags:
        update_tag_count(db, tag_name, increment=False)
    
    # Delete associated versions
    from database import SnippetVersion
    db.query(SnippetVersion).filter(SnippetVersion.snippet_id == snippet_id).delete()
    
    db.delete(db_snippet)
    db.commit()
    return True


def increment_snippet_use_count(db: Session, snippet_id: str) -> Optional[int]:
    """Increment use count when snippet is used"""
    db_snippet = get_snippet_by_id(db, snippet_id)
    if not db_snippet:
        return None
    
    db_snippet.use_count += 1
    db.commit()
    db.refresh(db_snippet)
    return db_snippet.use_count


def toggle_snippet_favorite(db: Session, snippet_id: str) -> Optional[bool]:
    """Toggle favorite status"""
    db_snippet = get_snippet_by_id(db, snippet_id)
    if not db_snippet:
        return None
    
    db_snippet.favorite = not db_snippet.favorite
    db.commit()
    db.refresh(db_snippet)
    return db_snippet.favorite


# ==================== Snippet Version Services ====================

def get_snippet_versions(db: Session, snippet_id: str):
    """Get all versions for a snippet"""
    from database import SnippetVersion
    return db.query(SnippetVersion).filter(
        SnippetVersion.snippet_id == snippet_id
    ).order_by(SnippetVersion.version).all()


def create_snippet_version(db: Session, snippet):
    """Create a new version from current snippet state"""
    from database import SnippetVersion
    from datetime import datetime
    import uuid
    
    existing_versions = get_snippet_versions(db, snippet.id)
    version_number = len(existing_versions) + 1
    
    db_version = SnippetVersion(
        id=str(uuid.uuid4()),
        snippet_id=snippet.id,
        version=version_number,
        code=snippet.code,
        description=f"Version {version_number}",
        created_at=datetime.utcnow(),
        created_by=snippet.created_by or "system"
    )
    
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    return db_version


def restore_snippet_version(db: Session, snippet_id: str, version_number: int):
    """Restore a previous version"""
    from database import SnippetVersion
    from datetime import datetime
    
    db_snippet = get_snippet_by_id(db, snippet_id)
    if not db_snippet:
        return None
    
    db_version = db.query(SnippetVersion).filter(
        SnippetVersion.snippet_id == snippet_id,
        SnippetVersion.version == version_number
    ).first()
    
    if not db_version:
        return None
    
    # Create version with current code before restoring
    create_snippet_version(db, db_snippet)
    
    # Restore old version
    db_snippet.code = db_version.code
    db_snippet.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_snippet)
    return db_snippet


# ==================== Tag Services ====================

def get_all_tags(db: Session):
    """Get all tags with counts"""
    from database import Tag
    return db.query(Tag).all()


def get_tag_by_name(db: Session, tag_name: str):
    """Get a specific tag"""
    from database import Tag
    return db.query(Tag).filter(Tag.name == tag_name).first()


def update_tag_count(db: Session, tag_name: str, increment: bool = True):
    """Update tag count (increment or decrement)"""
    from database import Tag
    
    db_tag = get_tag_by_name(db, tag_name)
    
    if increment:
        if db_tag:
            db_tag.count += 1
        else:
            db_tag = Tag(name=tag_name, count=1)
            db.add(db_tag)
    else:
        if db_tag:
            db_tag.count -= 1
            if db_tag.count <= 0:
                db.delete(db_tag)
                db.commit()
                return
    
    db.commit()
    if db_tag in db:
        db.refresh(db_tag)


def get_snippets_by_tag(db: Session, tag_name: str):
    """Get all snippets with a specific tag"""
    from database import Snippet
    return db.query(Snippet).filter(Snippet.tags.contains([tag_name])).all()


# ==================== Suite Services ====================

def get_all_suites(db: Session, active_only: bool = True) -> List[Suite]:
    """Get all available suites"""
    query = db.query(Suite)
    if active_only:
        query = query.filter(Suite.is_active == True)
    return query.order_by(Suite.display_name).all()


def get_suite_by_name(db: Session, suite_name: str) -> Optional[Suite]:
    """Get a specific suite by name"""
    return db.query(Suite).filter(Suite.name == suite_name).first()


def create_suite(db: Session, name: str, display_name: str, description: Optional[str] = None,
                 icon: str = "📦", category: Optional[str] = None,
                 plugins_required: List[str] = [], plugins_recommended: List[str] = [],
                 plugins_optional: List[str] = [], default_config: Optional[Dict] = None,
                 onboarding_steps: Optional[List[Dict]] = None, theme: Optional[Dict] = None) -> Suite:
    """Create a new suite"""
    db_suite = Suite(
        name=name,
        display_name=display_name,
        description=description,
        icon=icon,
        category=category,
        plugins_required=plugins_required,
        plugins_recommended=plugins_recommended,
        plugins_optional=plugins_optional,
        default_config=default_config,
        onboarding_steps=onboarding_steps,
        theme=theme,
        is_active=True
    )
    db.add(db_suite)
    db.commit()
    db.refresh(db_suite)
    return db_suite


def update_suite(db: Session, suite_name: str, **kwargs) -> Optional[Suite]:
    """Update a suite"""
    db_suite = get_suite_by_name(db, suite_name)
    if not db_suite:
        return None

    for key, value in kwargs.items():
        if hasattr(db_suite, key) and value is not None:
            setattr(db_suite, key, value)

    db.commit()
    db.refresh(db_suite)
    return db_suite


def delete_suite(db: Session, suite_name: str) -> bool:
    """Delete a suite (soft delete by setting is_active to False)"""
    db_suite = get_suite_by_name(db, suite_name)
    if not db_suite:
        return False

    db_suite.is_active = False
    db.commit()
    return True


def hard_delete_suite(db: Session, suite_name: str) -> bool:
    """Permanently delete a suite"""
    db_suite = get_suite_by_name(db, suite_name)
    if not db_suite:
        return False

    # Also delete any user selections for this suite
    db.query(UserSuiteSelection).filter(UserSuiteSelection.suite_name == suite_name).delete()
    db.delete(db_suite)
    db.commit()
    return True


# ==================== User Suite Selection Services ====================

def get_user_active_suite(db: Session, user_id: str = "default") -> Optional[UserSuiteSelection]:
    """Get the user's currently active suite selection"""
    return db.query(UserSuiteSelection).filter(
        UserSuiteSelection.user_id == user_id,
        UserSuiteSelection.is_active == True
    ).first()


def get_user_suite_history(db: Session, user_id: str = "default") -> List[UserSuiteSelection]:
    """Get all suite selections for a user (history)"""
    return db.query(UserSuiteSelection).filter(
        UserSuiteSelection.user_id == user_id
    ).order_by(UserSuiteSelection.activated_at.desc()).all()


def activate_suite_for_user(db: Session, suite_name: str, enabled_plugins: List[str],
                            user_id: str = "default", onboarding_data: Optional[Dict] = None) -> UserSuiteSelection:
    """Activate a suite for a user, deactivating any previous active suite"""
    # Verify suite exists
    suite = get_suite_by_name(db, suite_name)
    if not suite:
        raise ValueError(f"Suite '{suite_name}' not found")

    # Validate required plugins are included
    missing_required = set(suite.plugins_required or []) - set(enabled_plugins)
    if missing_required:
        raise ValueError(f"Missing required plugins: {list(missing_required)}")

    # Deactivate current active suite
    current_active = get_user_active_suite(db, user_id)
    if current_active:
        current_active.is_active = False

    # Create new active selection
    selection = UserSuiteSelection(
        id=str(uuid.uuid4()),
        user_id=user_id,
        suite_name=suite_name,
        enabled_plugins=enabled_plugins,
        onboarding_data=onboarding_data,
        is_active=True
    )
    db.add(selection)

    # Update plugin states based on selection
    _sync_plugin_states_with_suite(db, enabled_plugins, suite)

    db.commit()
    db.refresh(selection)
    return selection


def update_user_suite_plugins(db: Session, user_id: str, enabled_plugins: List[str]) -> Optional[UserSuiteSelection]:
    """Update enabled plugins for user's active suite"""
    selection = get_user_active_suite(db, user_id)
    if not selection:
        return None

    # Verify required plugins are still included
    suite = get_suite_by_name(db, selection.suite_name)
    if suite:
        missing_required = set(suite.plugins_required or []) - set(enabled_plugins)
        if missing_required:
            raise ValueError(f"Cannot disable required plugins: {list(missing_required)}")

    selection.enabled_plugins = enabled_plugins

    # Sync plugin states
    if suite:
        _sync_plugin_states_with_suite(db, enabled_plugins, suite)

    db.commit()
    db.refresh(selection)
    return selection


def deactivate_user_suite(db: Session, user_id: str = "default") -> bool:
    """Deactivate the user's current suite (return to no-suite mode)"""
    selection = get_user_active_suite(db, user_id)
    if not selection:
        return False

    selection.is_active = False
    db.commit()
    return True


def _sync_plugin_states_with_suite(db: Session, enabled_plugins: List[str], suite: Suite):
    """Sync plugin enabled states based on suite selection"""
    all_suite_plugins = set(
        (suite.plugins_required or []) +
        (suite.plugins_recommended or []) +
        (suite.plugins_optional or [])
    )

    for plugin_name in all_suite_plugins:
        is_enabled = plugin_name in enabled_plugins
        is_required = plugin_name in (suite.plugins_required or [])
        set_plugin_enabled(db, plugin_name, is_enabled, is_core=is_required)


def get_suite_with_user_selection(db: Session, suite_name: str, user_id: str = "default") -> Optional[Dict]:
    """Get suite details along with user's selection status"""
    suite = get_suite_by_name(db, suite_name)
    if not suite:
        return None

    user_selection = db.query(UserSuiteSelection).filter(
        UserSuiteSelection.user_id == user_id,
        UserSuiteSelection.suite_name == suite_name,
        UserSuiteSelection.is_active == True
    ).first()

    return {
        "suite": suite,
        "is_selected": user_selection is not None,
        "enabled_plugins": user_selection.enabled_plugins if user_selection else [],
        "onboarding_data": user_selection.onboarding_data if user_selection else None
    }


def seed_default_suites(db: Session):
    """Seed default suite definitions if they don't exist"""
    default_suites = [
        {
            "name": "job-seeker",
            "display_name": "Job Seeker Assistant",
            "description": "Land your dream job with resume tools, application tracking, and interview preparation",
            "icon": "💼",
            "category": "career",
            "plugins_required": ["tasks"],
            "plugins_recommended": ["pomodoro", "snippet-manager"],
            "plugins_optional": ["notification-center"],
            "default_config": {
                "ai_persona": "career-coach",
                "dashboard_widgets": ["tasks-overview", "upcoming-deadlines", "weekly-goals"]
            }
        },
        {
            "name": "property-finder",
            "display_name": "Home Buyer Assistant",
            "description": "Find your perfect home with property tracking, mortgage calculations, and area research",
            "icon": "🏠",
            "category": "lifestyle",
            "plugins_required": ["tasks"],
            "plugins_recommended": ["notification-center"],
            "plugins_optional": ["snippet-manager"],
            "default_config": {
                "ai_persona": "real-estate-advisor",
                "dashboard_widgets": ["property-watchlist", "mortgage-calculator", "neighborhood-stats"]
            }
        },
        {
            "name": "parent-educator",
            "display_name": "Parent & Teacher Helper",
            "description": "Support your child's education with lesson planning, progress tracking, and learning resources",
            "icon": "📚",
            "category": "education",
            "plugins_required": ["tasks"],
            "plugins_recommended": ["pomodoro"],
            "plugins_optional": ["notification-center", "snippet-manager"],
            "default_config": {
                "ai_persona": "education-assistant",
                "dashboard_widgets": ["learning-goals", "weekly-schedule", "achievement-tracker"]
            }
        },
        {
            "name": "habit-trainer",
            "display_name": "Personal Habit Coach",
            "description": "Build lasting habits with streak tracking, daily journaling, and goal management",
            "icon": "🎯",
            "category": "productivity",
            "plugins_required": ["tasks", "pomodoro"],
            "plugins_recommended": ["notification-center"],
            "plugins_optional": ["snippet-manager"],
            "default_config": {
                "ai_persona": "habit-coach",
                "dashboard_widgets": ["habit-streaks", "daily-journal", "weekly-review"]
            }
        },
        {
            "name": "wedding-prep",
            "display_name": "Wedding Planner",
            "description": "Plan your perfect wedding with budget tracking, vendor management, and timeline organization",
            "icon": "💒",
            "category": "lifestyle",
            "plugins_required": ["tasks"],
            "plugins_recommended": ["notification-center"],
            "plugins_optional": ["snippet-manager", "pomodoro"],
            "default_config": {
                "ai_persona": "wedding-planner",
                "dashboard_widgets": ["budget-tracker", "vendor-list", "countdown-timer", "guest-rsvp"]
            }
        },
        {
            "name": "developer",
            "display_name": "Developer Workspace",
            "description": "Boost your coding productivity with code snippets, task management, and focus tools",
            "icon": "💻",
            "category": "development",
            "plugins_required": ["tasks", "snippet-manager"],
            "plugins_recommended": ["pomodoro", "jira"],
            "plugins_optional": ["notification-center", "rss-reader"],
            "default_config": {
                "ai_persona": "coding-assistant",
                "dashboard_widgets": ["active-tasks", "recent-snippets", "pomodoro-timer"]
            }
        }
    ]

    for suite_data in default_suites:
        existing = get_suite_by_name(db, suite_data["name"])
        if not existing:
            create_suite(db, **suite_data)
