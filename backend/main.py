import os
import importlib.util
import json
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
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

app = FastAPI(title="SuperDashboard API")

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

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "gpt-4"  # Default to GPT-4

# Initialize database on startup
init_db()

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
        assigned_to=t.assigned_to
    ) for t in db_tasks]

@app.post("/tasks", response_model=Task)
async def create_task(task: Task, db: Session = Depends(get_db)):
    """Create a new task"""
    import uuid
    task_id = str(uuid.uuid4())
    db_task = services.create_task(
        db=db,
        task_id=task_id,
        title=task.title,
        description=task.description,
        status=task.status,
        assigned_to=task.assigned_to
    )
    return Task(
        id=db_task.id,
        title=db_task.title,
        description=db_task.description,
        status=db_task.status,
        assigned_to=db_task.assigned_to
    )

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

# ==================== Server Startup ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.host, port=config.port)
