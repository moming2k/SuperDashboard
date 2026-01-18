"""
Service layer for database operations
Provides clean interface for database interactions with dependency injection
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from database import Task, MCPServer, PluginState, PluginOrder, SystemConfig, DashboardLayout


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
