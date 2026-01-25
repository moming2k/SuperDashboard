import os
import importlib.util
import json
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime as dt
from sqlalchemy.orm import Session

# Import configuration and validation
from config import config, validate_startup_config

# Import database modules
from database import init_db, get_db, Task as DBTask, MCPServer as DBMCPServer
import services

# Import OpenAI
from openai import OpenAI

# Import logging
from logger import (
    app_logger,
    log_startup,
    log_plugin_loaded,
    log_plugin_failed,
    log_plugin_disabled
)

# Validate configuration at startup
validate_startup_config()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown event handler"""
    # Startup: Initialize database and seed default data
    from database import SessionLocal
    init_db()
    db_session = SessionLocal()
    try:
        services.seed_default_suites(db_session)
    finally:
        db_session.close()

    yield  # Application runs here


app = FastAPI(title="SuperDashboard API", lifespan=lifespan)

# Configure CORS using validated config
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Make OpenAI client optional - only initialize if API key is set
client = OpenAI(api_key=config.openai_api_key) if config.openai_api_key else None

# ==================== Pydantic Models ====================

class Task(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str = "pending"
    priority: str = "medium"  # low, medium, high, urgent
    due_date: Optional[str] = None  # ISO format datetime string
    assigned_to: Optional[str] = "user"

class MCPServer(BaseModel):
    name: str
    url: str
    apiKey: Optional[str] = None
    status: str = "disconnected"

class MCPToggleRequest(BaseModel):
    enabled: bool

class PluginToggleRequest(BaseModel):
    enabled: bool

class PluginConfigRequest(BaseModel):
    config: Dict[str, Any]

class PluginOrderUpdate(BaseModel):
    plugin_name: str
    order_index: int

class PluginOrderBulkUpdate(BaseModel):
    orders: List[PluginOrderUpdate]

class DashboardLayoutUpdate(BaseModel):
    layout: List[Dict[str, Any]]

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "gpt-4"  # Default to GPT-4


# ==================== Suite Pydantic Models ====================

class SuitePlugins(BaseModel):
    required: List[str] = []
    recommended: List[str] = []
    optional: List[str] = []


class SuiteCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    icon: str = "📦"
    category: Optional[str] = None
    plugins: SuitePlugins
    default_config: Optional[Dict[str, Any]] = None
    onboarding_steps: Optional[List[Dict[str, Any]]] = None
    theme: Optional[Dict[str, Any]] = None


class SuiteUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    plugins: Optional[SuitePlugins] = None
    default_config: Optional[Dict[str, Any]] = None
    onboarding_steps: Optional[List[Dict[str, Any]]] = None
    theme: Optional[Dict[str, Any]] = None


class SuiteResponse(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    icon: str
    category: Optional[str] = None
    plugins: SuitePlugins
    default_config: Optional[Dict[str, Any]] = None
    onboarding_steps: Optional[List[Dict[str, Any]]] = None
    theme: Optional[Dict[str, Any]] = None
    is_active: bool = True


class ActivateSuiteRequest(BaseModel):
    suite_name: str
    enabled_plugins: List[str]
    onboarding_data: Optional[Dict[str, Any]] = None


class UpdateSuitePluginsRequest(BaseModel):
    enabled_plugins: List[str]


class UserSuiteSelectionResponse(BaseModel):
    id: str
    user_id: str
    suite_name: str
    enabled_plugins: List[str]
    onboarding_data: Optional[Dict[str, Any]] = None
    is_active: bool
    activated_at: str


# ==================== Helper Functions ====================

PLUGINS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../plugins"))

def load_plugin_from_path(plugin_path: str, plugin_name: str, is_core: bool = False, db: Session = None):
    """Load a single plugin from a given path"""
    if db:
        # Check if plugin is enabled
        if not services.is_plugin_enabled(db, plugin_name, is_core):
            log_plugin_disabled(plugin_name)
            return

    # Check for legacy structure (main.py) or new structure (backend/main.py)
    main_py = os.path.join(plugin_path, "main.py")
    backend_main_py = os.path.join(plugin_path, "backend", "main.py")

    target_path = None
    if os.path.exists(backend_main_py):
        target_path = backend_main_py
    elif os.path.exists(main_py):
        target_path = main_py

    if target_path:
        try:
            spec = importlib.util.spec_from_file_location(f"plugins.{plugin_name}", target_path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            if hasattr(module, "router"):
                app.include_router(module.router, prefix=f"/plugins/{plugin_name}", tags=[plugin_name])
                log_plugin_loaded(plugin_name, target_path)
        except Exception as e:
            log_plugin_failed(plugin_name, str(e))

def load_plugins():
    """Load all plugins from plugins directory"""
    if not os.path.exists(PLUGINS_DIR):
        os.makedirs(PLUGINS_DIR, exist_ok=True)
        return

    # Get database session for checking enabled status
    db = next(get_db())

    try:
        # Load plugins from root plugins directory
        for item in os.listdir(PLUGINS_DIR):
            item_path = os.path.join(PLUGINS_DIR, item)
            if not os.path.isdir(item_path):
                continue

            # Special handling for 'core' directory - load its subdirectories
            if item == "core":
                core_path = item_path
                if os.path.exists(core_path):
                    for core_plugin in os.listdir(core_path):
                        core_plugin_path = os.path.join(core_path, core_plugin)
                        if os.path.isdir(core_plugin_path):
                            load_plugin_from_path(core_plugin_path, core_plugin, is_core=True, db=db)
            else:
                # Load regular plugins
                load_plugin_from_path(item_path, item, is_core=False, db=db)
    finally:
        db.close()

# Load plugins
load_plugins()

# ==================== Core Endpoints ====================

@app.get("/")
async def root():
    return {"message": "Welcome to SuperDashboard API"}

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint for monitoring system status.
    Returns information about API status, dependencies, and plugins.
    """
    from datetime import datetime

    # Check OpenAI API key status
    openai_configured = bool(client and client.api_key)

    # Count loaded plugins
    plugins_info = await list_plugins(db)
    total_plugins = len(plugins_info)
    enabled_plugins = len([p for p in plugins_info if p.get("enabled", False)])

    # Determine overall health status
    status = "healthy"
    issues = []

    if not openai_configured:
        issues.append("OpenAI API key not configured")

    health_data = {
        "status": status,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "api_version": "2.0",
        "services": {
            "database": {
                "status": "connected",
                "type": "postgresql"
            },
            "openai": {
                "configured": openai_configured,
                "status": "ready" if openai_configured else "not_configured"
            },
            "plugins": {
                "total": total_plugins,
                "enabled": enabled_plugins,
                "status": "operational"
            }
        }
    }

    if issues:
        health_data["issues"] = issues
        health_data["status"] = "degraded"

    return health_data

# ==================== Task Endpoints ====================

@app.get("/tasks", response_model=List[Task])
async def get_tasks(db: Session = Depends(get_db)):
    """Get all tasks"""
    db_tasks = services.get_tasks(db)
    return [Task(
        id=t.id,
        title=t.title,
        description=t.description,
        status=t.status,
        priority=t.priority,
        due_date=t.due_date.isoformat() if t.due_date else None,
        assigned_to=t.assigned_to
    ) for t in db_tasks]

@app.post("/tasks", response_model=Task)
async def create_task(task: Task, db: Session = Depends(get_db)):
    """Create a new task"""
    import uuid
    task_id = str(uuid.uuid4())
    
    # Parse due_date if provided
    due_date = None
    if task.due_date:
        try:
            due_date = dt.fromisoformat(task.due_date.replace('Z', '+00:00'))
        except:
            pass
    
    db_task = services.create_task(
        db=db,
        task_id=task_id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        due_date=due_date,
        assigned_to=task.assigned_to
    )
    return Task(
        id=db_task.id,
        title=db_task.title,
        description=db_task.description,
        status=db_task.status,
        priority=db_task.priority,
        due_date=db_task.due_date.isoformat() if db_task.due_date else None,
        assigned_to=db_task.assigned_to
    )

@app.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task: Task, db: Session = Depends(get_db)):
    """Update a task"""
    # Parse due_date if provided
    update_data = {
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "assigned_to": task.assigned_to
    }
    
    if task.due_date:
        try:
            update_data["due_date"] = dt.fromisoformat(task.due_date.replace('Z', '+00:00'))
        except:
            pass
    else:
        update_data["due_date"] = None
    
    db_task = services.update_task(db, task_id, **update_data)
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return Task(
        id=db_task.id,
        title=db_task.title,
        description=db_task.description,
        status=db_task.status,
        priority=db_task.priority,
        due_date=db_task.due_date.isoformat() if db_task.due_date else None,
        assigned_to=db_task.assigned_to
    )

@app.delete("/tasks/{task_id}")
async def delete_task(task_id: str, db: Session = Depends(get_db)):
    """Delete a task"""
    success = services.delete_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}

# ==================== AI Agent Endpoints ====================

@app.post("/agents/ask")
async def ask_agent(request: ChatRequest):
    """Chat with AI agent"""
    if not client or not client.api_key:
        return {"error": "OpenAI API key not set"}
    try:
        # Convert Pydantic models to dicts for OpenAI
        message_dicts = [{"role": m.role, "content": m.content} for m in request.messages]
        response = client.chat.completions.create(
            model=request.model,
            messages=message_dicts
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agents/analyze-tasks")
async def analyze_tasks(db: Session = Depends(get_db)):
    """Analyze tasks with AI"""
    if not client or not client.api_key:
        return {"error": "OpenAI API key not set"}

    db_tasks = services.get_tasks(db)
    if not db_tasks:
        return {"response": "No tasks to analyze."}

    tasks_str = "\n".join([f"- {t.title}: {t.description} (Status: {t.status})" for t in db_tasks])
    prompt = f"As an AI assistant for a Full Stack engineer, analyze these tasks and suggest the most critical one to work on next, and provide a brief implementation plan for it:\n\n{tasks_str}"

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}]
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Plugin Management Endpoints ====================

@app.get("/plugins")
async def list_plugins(db: Session = Depends(get_db)):
    """List all available plugins with their status"""
    plugins = []

    def scan_plugin_directory(directory_path: str, is_core: bool = False):
        """Scan a directory for plugins and add them to the plugins list"""
        for item in os.listdir(directory_path):
            item_path = os.path.join(directory_path, item)
            if not os.path.isdir(item_path):
                continue

            main_py = os.path.join(item_path, "main.py")
            backend_main_py = os.path.join(item_path, "backend", "main.py")
            manifest_path = os.path.join(item_path, "plugin.json")

            # Include plugin if it has backend code OR manifest (for frontend-only plugins)
            if os.path.exists(main_py) or os.path.exists(backend_main_py) or os.path.exists(manifest_path):
                manifest = {}
                if os.path.exists(manifest_path):
                    try:
                        with open(manifest_path, 'r') as f:
                            manifest = json.load(f)
                    except:
                        pass

                enabled = services.is_plugin_enabled(db, item, is_core)
                status = "enabled" if enabled else "disabled"
                config_data = services.get_plugin_config(db, item)
                order = services.get_plugin_order(db, item)

                plugins.append({
                    "name": item,
                    "status": status,
                    "enabled": enabled,
                    "isCore": is_core,
                    "config": config_data,
                    "manifest": manifest,
                    "order": order
                })

    # Scan root plugins directory
    if os.path.exists(PLUGINS_DIR):
        for item in os.listdir(PLUGINS_DIR):
            item_path = os.path.join(PLUGINS_DIR, item)
            if not os.path.isdir(item_path):
                continue

            # Special handling for 'core' directory - scan its subdirectories
            if item == "core":
                scan_plugin_directory(item_path, is_core=True)
            else:
                # Check if it's a regular plugin
                main_py = os.path.join(item_path, "main.py")
                backend_main_py = os.path.join(item_path, "backend", "main.py")
                manifest_path = os.path.join(item_path, "plugin.json")

                # Include plugin if it has backend code OR manifest (for frontend-only plugins)
                if os.path.exists(main_py) or os.path.exists(backend_main_py) or os.path.exists(manifest_path):
                    manifest = {}
                    if os.path.exists(manifest_path):
                        try:
                            with open(manifest_path, 'r') as f:
                                manifest = json.load(f)
                        except:
                            pass

                    enabled = services.is_plugin_enabled(db, item, False)
                    status = "enabled" if enabled else "disabled"
                    config_data = services.get_plugin_config(db, item)
                    order = services.get_plugin_order(db, item)

                    plugins.append({
                        "name": item,
                        "status": status,
                        "enabled": enabled,
                        "isCore": False,
                        "config": config_data,
                        "manifest": manifest,
                        "order": order
                    })

    # Sort plugins by order (None values go to the end)
    plugins.sort(key=lambda p: (p["order"] is None, p["order"] if p["order"] is not None else 0))

    return plugins

@app.put("/plugins/{plugin_name}/toggle")
async def toggle_plugin(plugin_name: str, request: PluginToggleRequest, db: Session = Depends(get_db)):
    """Toggle a plugin on/off. Core plugins cannot be disabled."""
    # Check if plugin exists
    plugin_path = os.path.join(PLUGINS_DIR, plugin_name)
    core_plugin_path = os.path.join(PLUGINS_DIR, "core", plugin_name)

    is_core = False
    if os.path.exists(core_plugin_path):
        is_core = True
    elif not os.path.exists(plugin_path):
        raise HTTPException(status_code=404, detail="Plugin not found")

    if is_core and not request.enabled:
        raise HTTPException(status_code=400, detail="Cannot disable core plugins")

    try:
        services.set_plugin_enabled(db, plugin_name, request.enabled, is_core)
        status = "enabled" if request.enabled else "disabled"
        return {
            "message": f"Plugin {plugin_name} {status} successfully. Please restart the server for changes to take effect.",
            "enabled": request.enabled,
            "requiresRestart": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/plugins/{plugin_name}/config")
async def get_plugin_configuration(plugin_name: str, db: Session = Depends(get_db)):
    """Get plugin configuration"""
    # Check if plugin exists
    plugin_path = os.path.join(PLUGINS_DIR, plugin_name)
    core_plugin_path = os.path.join(PLUGINS_DIR, "core", plugin_name)

    if not os.path.exists(plugin_path) and not os.path.exists(core_plugin_path):
        raise HTTPException(status_code=404, detail="Plugin not found")

    config_data = services.get_plugin_config(db, plugin_name)
    return {"config": config_data}

@app.put("/plugins/{plugin_name}/config")
async def update_plugin_configuration(plugin_name: str, request: PluginConfigRequest, db: Session = Depends(get_db)):
    """Update plugin configuration"""
    # Check if plugin exists
    plugin_path = os.path.join(PLUGINS_DIR, plugin_name)
    core_plugin_path = os.path.join(PLUGINS_DIR, "core", plugin_name)

    if not os.path.exists(plugin_path) and not os.path.exists(core_plugin_path):
        raise HTTPException(status_code=404, detail="Plugin not found")

    try:
        services.set_plugin_config(db, plugin_name, request.config)
        return {
            "message": f"Plugin {plugin_name} configuration updated successfully",
            "config": request.config
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/plugins/reorder")
async def reorder_plugins(request: PluginOrderBulkUpdate, db: Session = Depends(get_db)):
    """Update the display order for multiple plugins"""
    try:
        for order_update in request.orders:
            services.set_plugin_order(db, order_update.plugin_name, order_update.order_index)

        return {
            "message": "Plugin order updated successfully",
            "updated_count": len(request.orders)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== AI Models Endpoint ====================

@app.get("/models")
async def list_models():
    """List available AI models"""
    return {
        "models": [
            {
                "id": "gpt-4",
                "name": "GPT-4",
                "description": "Most capable, best for complex tasks",
                "provider": "openai"
            },
            {
                "id": "gpt-4-turbo",
                "name": "GPT-4 Turbo",
                "description": "Faster GPT-4 with 128k context",
                "provider": "openai"
            },
            {
                "id": "gpt-3.5-turbo",
                "name": "GPT-3.5 Turbo",
                "description": "Fast and efficient",
                "provider": "openai"
            }
        ]
    }

# ==================== Widget Management Endpoints ====================

@app.get("/widgets")
async def list_widgets(db: Session = Depends(get_db)):
    """Get all available widgets from all plugins"""
    widgets = []

    def scan_plugin_for_widgets(plugin_path: str, plugin_name: str, is_core: bool = False):
        """Scan a plugin for widget definitions"""
        manifest_path = os.path.join(plugin_path, "plugin.json")

        if not os.path.exists(manifest_path):
            return

        try:
            with open(manifest_path, 'r') as f:
                manifest = json.load(f)

            # Check if plugin is enabled
            if not services.is_plugin_enabled(db, plugin_name, is_core):
                return

            # Extract widgets from manifest
            plugin_widgets = manifest.get('widgets', [])
            for widget in plugin_widgets:
                widgets.append({
                    "id": f"{plugin_name}.{widget.get('id', 'widget')}",
                    "pluginName": plugin_name,
                    "displayName": widget.get('displayName', 'Unnamed Widget'),
                    "description": widget.get('description', ''),
                    "icon": widget.get('icon', '📦'),
                    "component": widget.get('component'),
                    "preview": widget.get('preview'),
                    "snapSizes": widget.get('snapSizes'),
                    "defaultSize": widget.get('defaultSize', {"w": 4, "h": 3, "minW": 2, "minH": 2}),
                    "category": widget.get('category', 'general')
                })
        except Exception as e:
            print(f"Failed to load widgets from {plugin_name}: {e}")

    # Scan all plugins
    if os.path.exists(PLUGINS_DIR):
        for item in os.listdir(PLUGINS_DIR):
            item_path = os.path.join(PLUGINS_DIR, item)
            if not os.path.isdir(item_path):
                continue

            # Handle core plugins
            if item == "core":
                for core_plugin in os.listdir(item_path):
                    core_plugin_path = os.path.join(item_path, core_plugin)
                    if os.path.isdir(core_plugin_path):
                        scan_plugin_for_widgets(core_plugin_path, core_plugin, is_core=True)
            else:
                # Regular plugins
                scan_plugin_for_widgets(item_path, item, is_core=False)

    return {"widgets": widgets}


# ==================== Dashboard Layout Endpoints ====================

@app.get("/dashboard/layout")
async def get_dashboard_layout(db: Session = Depends(get_db)):
    """Get user's dashboard layout"""
    layout = services.get_dashboard_layout(db)
    return {"layout": layout or []}


@app.put("/dashboard/layout")
async def update_dashboard_layout(request: DashboardLayoutUpdate, db: Session = Depends(get_db)):
    """Update user's dashboard layout"""
    try:
        services.set_dashboard_layout(db, request.layout)
        return {
            "message": "Dashboard layout saved successfully",
            "layout": request.layout
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== MCP (Model Context Protocol) Endpoints ====================

@app.get("/mcp/status")
async def mcp_status(db: Session = Depends(get_db)):
    """Get MCP server status"""
    mcp_enabled = services.get_mcp_enabled(db)
    mcp_servers = services.get_mcp_servers(db)

    return {
        "enabled": mcp_enabled,
        "servers": [
            {
                "name": s.name,
                "url": s.url,
                "apiKey": s.api_key,
                "status": s.status
            } for s in mcp_servers
        ],
        "message": f"MCP is {'enabled' if mcp_enabled else 'disabled'}. {len(mcp_servers)} server(s) configured."
    }

@app.post("/mcp/toggle")
async def toggle_mcp(request: MCPToggleRequest, db: Session = Depends(get_db)):
    """Toggle MCP enabled/disabled"""
    services.set_mcp_enabled(db, request.enabled)
    return {
        "enabled": request.enabled,
        "message": f"MCP {'enabled' if request.enabled else 'disabled'} successfully"
    }

@app.get("/mcp/servers")
async def get_mcp_servers(db: Session = Depends(get_db)):
    """Get list of configured MCP servers"""
    mcp_servers = services.get_mcp_servers(db)
    return {
        "servers": [
            {
                "name": s.name,
                "url": s.url,
                "apiKey": s.api_key,
                "status": s.status
            } for s in mcp_servers
        ]
    }

@app.post("/mcp/servers")
async def add_mcp_server(server: MCPServer, db: Session = Depends(get_db)):
    """Add a new MCP server"""
    # Check if server with same name already exists
    existing = services.get_mcp_server_by_name(db, server.name)
    if existing:
        raise HTTPException(status_code=400, detail="Server with this name already exists")

    # Create server
    db_server = services.create_mcp_server(
        db=db,
        name=server.name,
        url=server.url,
        api_key=server.apiKey,
        status="configured"
    )

    return {
        "message": "MCP server added successfully",
        "server": {
            "name": db_server.name,
            "url": db_server.url,
            "apiKey": db_server.api_key,
            "status": db_server.status
        }
    }

@app.delete("/mcp/servers/{server_name}")
async def remove_mcp_server(server_name: str, db: Session = Depends(get_db)):
    """Remove an MCP server"""
    success = services.delete_mcp_server(db, server_name)
    if not success:
        raise HTTPException(status_code=404, detail="MCP server not found")

    return {
        "message": f"MCP server '{server_name}' removed successfully"
    }


# ==================== Suite Endpoints ====================

@app.get("/suites")
async def list_suites(db: Session = Depends(get_db)):
    """List all available suites"""
    db_suites = services.get_all_suites(db)
    return {
        "suites": [
            {
                "name": s.name,
                "displayName": s.display_name,
                "description": s.description,
                "icon": s.icon,
                "category": s.category,
                "plugins": {
                    "required": s.plugins_required or [],
                    "recommended": s.plugins_recommended or [],
                    "optional": s.plugins_optional or []
                },
                "defaultConfig": s.default_config,
                "onboardingSteps": s.onboarding_steps,
                "theme": s.theme
            } for s in db_suites
        ]
    }


@app.get("/suites/{suite_name}")
async def get_suite(suite_name: str, db: Session = Depends(get_db)):
    """Get a specific suite by name"""
    db_suite = services.get_suite_by_name(db, suite_name)
    if not db_suite:
        raise HTTPException(status_code=404, detail=f"Suite '{suite_name}' not found")

    return {
        "name": db_suite.name,
        "displayName": db_suite.display_name,
        "description": db_suite.description,
        "icon": db_suite.icon,
        "category": db_suite.category,
        "plugins": {
            "required": db_suite.plugins_required or [],
            "recommended": db_suite.plugins_recommended or [],
            "optional": db_suite.plugins_optional or []
        },
        "defaultConfig": db_suite.default_config,
        "onboardingSteps": db_suite.onboarding_steps,
        "theme": db_suite.theme
    }


@app.post("/suites")
async def create_suite(suite: SuiteCreate, db: Session = Depends(get_db)):
    """Create a new suite"""
    # Check if suite already exists
    existing = services.get_suite_by_name(db, suite.name)
    if existing:
        raise HTTPException(status_code=400, detail=f"Suite '{suite.name}' already exists")

    try:
        db_suite = services.create_suite(
            db=db,
            name=suite.name,
            display_name=suite.display_name,
            description=suite.description,
            icon=suite.icon,
            category=suite.category,
            plugins_required=suite.plugins.required,
            plugins_recommended=suite.plugins.recommended,
            plugins_optional=suite.plugins.optional,
            default_config=suite.default_config,
            onboarding_steps=suite.onboarding_steps,
            theme=suite.theme
        )
        return {
            "message": f"Suite '{suite.name}' created successfully",
            "suite": {
                "name": db_suite.name,
                "displayName": db_suite.display_name,
                "description": db_suite.description,
                "icon": db_suite.icon,
                "category": db_suite.category,
                "plugins": {
                    "required": db_suite.plugins_required or [],
                    "recommended": db_suite.plugins_recommended or [],
                    "optional": db_suite.plugins_optional or []
                }
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/suites/{suite_name}")
async def update_suite(suite_name: str, suite: SuiteUpdate, db: Session = Depends(get_db)):
    """Update an existing suite"""
    update_data = {}
    if suite.display_name is not None:
        update_data["display_name"] = suite.display_name
    if suite.description is not None:
        update_data["description"] = suite.description
    if suite.icon is not None:
        update_data["icon"] = suite.icon
    if suite.category is not None:
        update_data["category"] = suite.category
    if suite.plugins is not None:
        update_data["plugins_required"] = suite.plugins.required
        update_data["plugins_recommended"] = suite.plugins.recommended
        update_data["plugins_optional"] = suite.plugins.optional
    if suite.default_config is not None:
        update_data["default_config"] = suite.default_config
    if suite.onboarding_steps is not None:
        update_data["onboarding_steps"] = suite.onboarding_steps
    if suite.theme is not None:
        update_data["theme"] = suite.theme

    db_suite = services.update_suite(db, suite_name, **update_data)
    if not db_suite:
        raise HTTPException(status_code=404, detail=f"Suite '{suite_name}' not found")

    return {
        "message": f"Suite '{suite_name}' updated successfully",
        "suite": {
            "name": db_suite.name,
            "displayName": db_suite.display_name,
            "description": db_suite.description,
            "icon": db_suite.icon,
            "category": db_suite.category
        }
    }


@app.delete("/suites/{suite_name}")
async def delete_suite(suite_name: str, db: Session = Depends(get_db)):
    """Delete a suite (soft delete)"""
    success = services.delete_suite(db, suite_name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Suite '{suite_name}' not found")

    return {"message": f"Suite '{suite_name}' deleted successfully"}


# ==================== User Suite Selection Endpoints ====================

@app.get("/suites/user/active")
async def get_user_active_suite(user_id: str = "default", db: Session = Depends(get_db)):
    """Get the user's currently active suite selection"""
    selection = services.get_user_active_suite(db, user_id)
    if not selection:
        return {"active_suite": None}

    # Get suite details
    suite = services.get_suite_by_name(db, selection.suite_name)

    return {
        "active_suite": {
            "id": selection.id,
            "suite_name": selection.suite_name,
            "suite_display_name": suite.display_name if suite else selection.suite_name,
            "suite_icon": suite.icon if suite else "📦",
            "enabled_plugins": selection.enabled_plugins,
            "onboarding_data": selection.onboarding_data,
            "activated_at": selection.activated_at.isoformat() if selection.activated_at else None
        }
    }


@app.post("/suites/user/activate")
async def activate_suite(request: ActivateSuiteRequest, user_id: str = "default", db: Session = Depends(get_db)):
    """Activate a suite for the user"""
    try:
        selection = services.activate_suite_for_user(
            db=db,
            suite_name=request.suite_name,
            enabled_plugins=request.enabled_plugins,
            user_id=user_id,
            onboarding_data=request.onboarding_data
        )

        suite = services.get_suite_by_name(db, request.suite_name)

        return {
            "message": f"Suite '{suite.display_name if suite else request.suite_name}' activated successfully",
            "selection": {
                "id": selection.id,
                "suite_name": selection.suite_name,
                "enabled_plugins": selection.enabled_plugins,
                "activated_at": selection.activated_at.isoformat() if selection.activated_at else None
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/suites/user/plugins")
async def update_user_suite_plugins(request: UpdateSuitePluginsRequest, user_id: str = "default", db: Session = Depends(get_db)):
    """Update enabled plugins for user's active suite"""
    try:
        selection = services.update_user_suite_plugins(db, user_id, request.enabled_plugins)
        if not selection:
            raise HTTPException(status_code=404, detail="No active suite found for user")

        return {
            "message": "Enabled plugins updated successfully",
            "enabled_plugins": selection.enabled_plugins
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/suites/user/deactivate")
async def deactivate_user_suite(user_id: str = "default", db: Session = Depends(get_db)):
    """Deactivate the user's current suite"""
    success = services.deactivate_user_suite(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="No active suite found for user")

    return {"message": "Suite deactivated successfully"}


@app.get("/suites/user/history")
async def get_user_suite_history(user_id: str = "default", db: Session = Depends(get_db)):
    """Get user's suite selection history"""
    history = services.get_user_suite_history(db, user_id)

    return {
        "history": [
            {
                "id": h.id,
                "suite_name": h.suite_name,
                "enabled_plugins": h.enabled_plugins,
                "is_active": h.is_active,
                "activated_at": h.activated_at.isoformat() if h.activated_at else None
            } for h in history
        ]
    }


# ==================== Server Startup ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.host, port=config.port)
