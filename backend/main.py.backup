import os
import importlib.util
import json
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import openai
from dotenv import load_dotenv
from sqlalchemy.orm import Session

load_dotenv()

# Import database modules
from database import init_db, get_db, PluginOrder

app = FastAPI(title="SuperDashboard API")

# Configure CORS with environment-aware origins
# In development, defaults to allowing all origins
# In production, should be set to specific allowed origins (comma-separated)
cors_origins = os.getenv("CORS_ORIGINS", "*")
if cors_origins == "*":
    allowed_origins = ["*"]
else:
    # Split comma-separated origins and strip whitespace
    allowed_origins = [origin.strip() for origin in cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from openai import OpenAI

# Make OpenAI client optional - only initialize if API key is set
openai_api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=openai_api_key) if openai_api_key else None

# Plugin state management
PLUGIN_STATE_FILE = os.path.join(os.path.dirname(__file__), "plugin_state.json")

def load_plugin_state() -> Dict[str, Dict[str, Any]]:
    """Load plugin state from JSON file"""
    if os.path.exists(PLUGIN_STATE_FILE):
        try:
            with open(PLUGIN_STATE_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading plugin state: {e}")
            return {}
    return {}

def save_plugin_state(state: Dict[str, Dict[str, Any]]):
    """Save plugin state to JSON file"""
    try:
        with open(PLUGIN_STATE_FILE, 'w') as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        print(f"Error saving plugin state: {e}")

def is_plugin_enabled(plugin_name: str, is_core: bool = False) -> bool:
    """Check if a plugin is enabled. Core plugins are always enabled."""
    if is_core:
        return True

    state = load_plugin_state()
    plugin_state = state.get(plugin_name, {})
    return plugin_state.get("enabled", True)  # Default to enabled

def get_plugin_config(plugin_name: str) -> Dict[str, Any]:
    """Get plugin configuration"""
    state = load_plugin_state()
    plugin_state = state.get(plugin_name, {})
    return plugin_state.get("config", {})

def set_plugin_enabled(plugin_name: str, enabled: bool, is_core: bool = False):
    """Set plugin enabled state. Cannot disable core plugins."""
    if is_core:
        raise HTTPException(status_code=400, detail="Cannot disable core plugins")

    state = load_plugin_state()
    if plugin_name not in state:
        state[plugin_name] = {}
    state[plugin_name]["enabled"] = enabled
    save_plugin_state(state)

def set_plugin_config(plugin_name: str, config: Dict[str, Any]):
    """Set plugin configuration"""
    state = load_plugin_state()
    if plugin_name not in state:
        state[plugin_name] = {}
    state[plugin_name]["config"] = config
    save_plugin_state(state)

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

db_tasks = []
mcp_servers = []
mcp_enabled = False

# Initialize database on startup
init_db()

def get_plugin_order_from_db(plugin_name: str, db: Session) -> Optional[int]:
    """Get plugin order from database"""
    order_entry = db.query(PluginOrder).filter(PluginOrder.plugin_name == plugin_name).first()
    return order_entry.order_index if order_entry else None

def set_plugin_order_in_db(plugin_name: str, order_index: int, db: Session):
    """Set plugin order in database"""
    order_entry = db.query(PluginOrder).filter(PluginOrder.plugin_name == plugin_name).first()
    if order_entry:
        order_entry.order_index = order_index
    else:
        order_entry = PluginOrder(plugin_name=plugin_name, order_index=order_index)
        db.add(order_entry)
    db.commit()

@app.get("/")
async def root():
    return {"message": "Welcome to SuperDashboard API"}

@app.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring system status.
    Returns information about API status, dependencies, and plugins.
    """
    from datetime import datetime

    # Check OpenAI API key status
    openai_configured = bool(client.api_key)

    # Count loaded plugins
    plugins_info = await list_plugins()
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

@app.get("/tasks", response_model=List[Task])
async def get_tasks():
    return db_tasks

@app.post("/tasks", response_model=Task)
async def create_task(task: Task):
    task.id = str(len(db_tasks) + 1)
    db_tasks.append(task)
    return task

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "gpt-4"  # Default to GPT-4

@app.post("/agents/ask")
async def ask_agent(request: ChatRequest):
    if not client.api_key:
        return {"error": "OpenAI API key not set"}
    try:
        # Convert Pydantic models to dicts for OpenAI
        message_dicts = [{"role": m.role, "content": m.content} for m in request.messages]
        response = client.chat.completions.create(
            model=request.model,  # Use the model from request
            messages=message_dicts
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agents/analyze-tasks")
async def analyze_tasks():
    if not client.api_key:
        return {"error": "OpenAI API key not set"}
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

# Plugin System
PLUGINS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../plugins"))

def load_plugin_from_path(plugin_path, plugin_name, is_core=False):
    """Load a single plugin from a given path"""
    # Check if plugin is enabled
    if not is_plugin_enabled(plugin_name, is_core):
        print(f"Plugin {plugin_name} is disabled, skipping load")
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
                print(f"Loaded router for plugin: {plugin_name} from {target_path}")
        except Exception as e:
            print(f"Failed to load plugin {plugin_name}: {e}")

def load_plugins():
    if not os.path.exists(PLUGINS_DIR):
        os.makedirs(PLUGINS_DIR, exist_ok=True)
        return

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
                        load_plugin_from_path(core_plugin_path, core_plugin, is_core=True)
        else:
            # Load regular plugins
            load_plugin_from_path(item_path, item, is_core=False)

load_plugins()

@app.get("/plugins")
async def list_plugins(db: Session = Depends(get_db)):
    import json
    plugins = []

    def scan_plugin_directory(directory_path, is_core=False):
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

                enabled = is_plugin_enabled(item, is_core)
                status = "enabled" if enabled else "disabled"
                config = get_plugin_config(item)
                order = get_plugin_order_from_db(item, db)

                plugins.append({
                    "name": item,
                    "status": status,
                    "enabled": enabled,
                    "isCore": is_core,
                    "config": config,
                    "manifest": manifest,
                    "order": order
                })

    # Scan root plugins directory
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

                enabled = is_plugin_enabled(item, False)
                status = "enabled" if enabled else "disabled"
                config = get_plugin_config(item)
                order = get_plugin_order_from_db(item, db)

                plugins.append({
                    "name": item,
                    "status": status,
                    "enabled": enabled,
                    "isCore": False,
                    "config": config,
                    "manifest": manifest,
                    "order": order
                })

    # Sort plugins by order (None values go to the end)
    plugins.sort(key=lambda p: (p["order"] is None, p["order"] if p["order"] is not None else 0))

    return plugins

@app.put("/plugins/{plugin_name}/toggle")
async def toggle_plugin(plugin_name: str, request: PluginToggleRequest):
    """Toggle a plugin on/off. Core plugins cannot be disabled."""
    # Check if plugin exists
    plugin_path = os.path.join(PLUGINS_DIR, plugin_name)
    core_plugin_path = os.path.join(PLUGINS_DIR, "core", plugin_name)

    is_core = False
    if os.path.exists(core_plugin_path):
        is_core = True
    elif not os.path.exists(plugin_path):
        raise HTTPException(status_code=404, detail="Plugin not found")

    try:
        set_plugin_enabled(plugin_name, request.enabled, is_core)
        status = "enabled" if request.enabled else "disabled"
        return {
            "message": f"Plugin {plugin_name} {status} successfully. Please restart the server for changes to take effect.",
            "enabled": request.enabled,
            "requiresRestart": True
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/plugins/{plugin_name}/config")
async def get_plugin_configuration(plugin_name: str):
    """Get plugin configuration"""
    # Check if plugin exists
    plugin_path = os.path.join(PLUGINS_DIR, plugin_name)
    core_plugin_path = os.path.join(PLUGINS_DIR, "core", plugin_name)

    if not os.path.exists(plugin_path) and not os.path.exists(core_plugin_path):
        raise HTTPException(status_code=404, detail="Plugin not found")

    config = get_plugin_config(plugin_name)
    return {"config": config}

@app.put("/plugins/{plugin_name}/config")
async def update_plugin_configuration(plugin_name: str, request: PluginConfigRequest):
    """Update plugin configuration"""
    # Check if plugin exists
    plugin_path = os.path.join(PLUGINS_DIR, plugin_name)
    core_plugin_path = os.path.join(PLUGINS_DIR, "core", plugin_name)

    if not os.path.exists(plugin_path) and not os.path.exists(core_plugin_path):
        raise HTTPException(status_code=404, detail="Plugin not found")

    try:
        set_plugin_config(plugin_name, request.config)
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
            set_plugin_order_in_db(order_update.plugin_name, order_update.order_index, db)

        return {
            "message": "Plugin order updated successfully",
            "updated_count": len(request.orders)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

@app.get("/mcp/status")
async def mcp_status():
    """Get MCP server status"""
    return {
        "enabled": mcp_enabled,
        "servers": mcp_servers,
        "message": f"MCP is {'enabled' if mcp_enabled else 'disabled'}. {len(mcp_servers)} server(s) configured."
    }

@app.post("/mcp/toggle")
async def toggle_mcp(request: MCPToggleRequest):
    """Toggle MCP enabled/disabled"""
    global mcp_enabled
    mcp_enabled = request.enabled
    return {
        "enabled": mcp_enabled,
        "message": f"MCP {'enabled' if mcp_enabled else 'disabled'} successfully"
    }

@app.get("/mcp/servers")
async def get_mcp_servers():
    """Get list of configured MCP servers"""
    return {
        "servers": mcp_servers
    }

@app.post("/mcp/servers")
async def add_mcp_server(server: MCPServer):
    """Add a new MCP server"""
    # Check if server with same name already exists
    if any(s.name == server.name for s in mcp_servers):
        raise HTTPException(status_code=400, detail="Server with this name already exists")

    # Set initial status
    server.status = "configured"
    mcp_servers.append(server)

    return {
        "message": "MCP server added successfully",
        "server": server
    }

@app.delete("/mcp/servers/{server_name}")
async def remove_mcp_server(server_name: str):
    """Remove an MCP server"""
    global mcp_servers
    mcp_servers = [s for s in mcp_servers if s.name != server_name]

    return {
        "message": f"MCP server '{server_name}' removed successfully"
    }

if __name__ == "__main__":
    import uvicorn
    # Detect if running in devcontainer
    is_devcontainer = os.getenv("DEVCONTAINER", "false").lower() == "true"
    # Use port 18010 in devcontainer, 8000 locally (can be overridden by PORT env var)
    default_port = 18010 if is_devcontainer else 8000
    port = int(os.getenv("PORT", default_port))
    uvicorn.run(app, host="0.0.0.0", port=port)

