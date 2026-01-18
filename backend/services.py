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
