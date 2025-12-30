import os
import importlib.util
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import openai
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="SuperDashboard API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from openai import OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class Task(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str = "pending"
    assigned_to: Optional[str] = "user"

db_tasks = []

@app.get("/")
async def root():
    return {"message": "Welcome to SuperDashboard API"}

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

def load_plugins():
    if not os.path.exists(PLUGINS_DIR):
        os.makedirs(PLUGINS_DIR, exist_ok=True)
        return
    
    for item in os.listdir(PLUGINS_DIR):
        item_path = os.path.join(PLUGINS_DIR, item)
        # Check for legacy structure (main.py) or new structure (backend/main.py)
        main_py = os.path.join(item_path, "main.py")
        backend_main_py = os.path.join(item_path, "backend", "main.py")
        
        target_path = None
        if os.path.isdir(item_path):
            if os.path.exists(backend_main_py):
                target_path = backend_main_py
            elif os.path.exists(main_py):
                target_path = main_py
                
        if target_path:
            try:
                spec = importlib.util.spec_from_file_location(f"plugins.{item}", target_path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                
                if hasattr(module, "router"):
                    app.include_router(module.router, prefix=f"/plugins/{item}", tags=[item])
                    print(f"Loaded router for plugin: {item} from {target_path}")
            except Exception as e:
                print(f"Failed to load plugin {item}: {e}")

load_plugins()

@app.get("/plugins")
async def list_plugins():
    import json
    plugins = []
    for item in os.listdir(PLUGINS_DIR):
        item_path = os.path.join(PLUGINS_DIR, item)
        if not os.path.isdir(item_path):
            continue

        main_py = os.path.join(item_path, "main.py")
        backend_main_py = os.path.join(item_path, "backend", "main.py")
        manifest_path = os.path.join(item_path, "plugin.json")
        
        if os.path.exists(main_py) or os.path.exists(backend_main_py):
            manifest = {}
            if os.path.exists(manifest_path):
                try:
                    with open(manifest_path, 'r') as f:
                        manifest = json.load(f)
                except:
                    pass
            plugins.append({"name": item, "status": "active", "manifest": manifest})
    return plugins

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
        "enabled": False,
        "servers": [],
        "message": "MCP support is available but not configured. Add MCP server configuration to enable."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
