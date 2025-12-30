# CLAUDE.md - SuperDashboard AI Assistant Guide

> **Last Updated**: 2025-12-30
> **Project**: SuperDashboard - Full-stack engineering dashboard with AI assistant and plugin system
> **License**: MIT (Copyright 2025 Chris Chan)

This document serves as a comprehensive guide for AI assistants working on the SuperDashboard codebase. It explains the architecture, conventions, and workflows to help you make informed decisions when modifying or extending the system.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Repository Structure](#repository-structure)
3. [Technology Stack](#technology-stack)
4. [Architecture & Key Concepts](#architecture--key-concepts)
5. [Development Workflows](#development-workflows)
6. [Code Conventions](#code-conventions)
7. [Plugin System Guide](#plugin-system-guide)
8. [API Patterns](#api-patterns)
9. [Frontend Patterns](#frontend-patterns)
10. [Environment Configuration](#environment-configuration)
11. [Common Tasks](#common-tasks)
12. [Testing](#testing)
13. [Gotchas & Important Notes](#gotchas--important-notes)

---

## Project Overview

**SuperDashboard** is a modern full-stack web application designed for software engineers to manage tasks, interact with an AI assistant, and extend functionality through a dynamic plugin system.

### Key Features

- **Task Management**: Create and track engineering tasks with status updates
- **AI Assistant**: GPT-4 powered chat and task analysis
- **Plugin System**: Manifest-driven, self-contained plugins with hot-loading
- **Jira Integration**: Real-time issue tracking via plugin (JQL queries, status updates, comments)
- **Modern UI**: Glass-morphism design with Tailwind CSS v4
- **Async Architecture**: FastAPI backend with async/await patterns

### Project Goals

- Provide a minimal, fast, and extensible engineering dashboard
- Enable AI-powered workflow automation
- Support dynamic plugin loading without server restarts
- Maintain clean separation between core and plugin functionality

---

## Repository Structure

```
SuperDashboard/
├── backend/                          # Python FastAPI server
│   ├── main.py                       # Core API + plugin loader (148 lines)
│   ├── requirements.txt              # Python dependencies (23 packages)
│   └── .env.example                  # Environment variable template
│
├── frontend/                         # React + Vite application
│   ├── src/
│   │   ├── App.jsx                   # Main app component (295 lines)
│   │   ├── main.jsx                  # React entry point
│   │   ├── index.css                 # Tailwind CSS + custom theme variables
│   │   ├── App.css                   # Legacy CSS (minimal)
│   │   ├── assets/                   # Static assets (images, icons)
│   │   └── plugins/                  # Symlinks to plugin frontend components
│   │       └── jira -> ../../plugins/jira/frontend
│   ├── public/                       # Public static files
│   ├── package.json                  # Frontend dependencies
│   ├── vite.config.js                # Vite bundler config
│   ├── eslint.config.js              # ESLint configuration
│   └── index.html                    # HTML entry point
│
├── plugins/                          # Plugin directory (auto-discovered)
│   ├── jira/                         # Jira Cloud integration plugin
│   │   ├── backend/
│   │   │   └── main.py               # Jira API endpoints (147 lines)
│   │   ├── frontend/
│   │   │   └── JiraTasks.jsx         # Jira UI component
│   │   └── plugin.json               # Plugin manifest
│   │
│   └── calculator/                   # Example calculator plugin
│       └── main.py                   # Simple API endpoints (11 lines)
│
├── .gitignore                        # Centralized ignore rules (Python + Node.js)
├── LICENSE                           # MIT License
└── CLAUDE.md                         # This file
```

### Key Directories

- **`backend/`**: All server-side Python code (FastAPI, OpenAI integration)
- **`frontend/`**: All client-side React code (UI components, state management)
- **`plugins/`**: Self-contained plugin modules with optional backend and frontend
- **`frontend/src/plugins/`**: Symlinks to plugin frontend components (auto-created during setup)

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI framework (functional components + hooks) |
| Vite | 7.2.4 | Build tool (dev server + bundler) |
| Tailwind CSS | 4.1.18 | Utility-first CSS framework |
| ESLint | 9.39.1 | Code quality and linting |

**Frontend Features:**
- No TypeScript (pure JavaScript/JSX)
- React 19 features (Suspense, lazy loading, Error Boundaries)
- Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Hot Module Replacement (HMR) for fast development

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| FastAPI | 0.128.0 | Async web framework |
| Uvicorn | 0.40.0 | ASGI server |
| Pydantic | 2.12.5 | Data validation and serialization |
| OpenAI | 2.14.0 | GPT-4 API integration |
| httpx | 0.28.1 | Async HTTP client (for plugin requests) |
| python-dotenv | 1.2.1 | Environment variable management |

**Backend Features:**
- Async/await patterns throughout
- CORS enabled for all origins (configure for production)
- No database (in-memory storage only)
- Dynamic plugin loading with importlib

### Build & Development

- **Package Manager**: npm (frontend), pip (backend)
- **Python Version**: 3.x (tested with 3.11+)
- **Node Version**: 18+ recommended
- **Server**: Uvicorn (ASGI) running on port 8000
- **Dev Server**: Vite running on port 5173 (default)

---

## Architecture & Key Concepts

### 1. Plugin System (Core Innovation)

The plugin system is the most important architectural feature. It allows:
- **Dynamic Discovery**: Backend scans `/plugins` directory on startup
- **Automatic Registration**: Plugins export a `router` object that gets mounted automatically
- **Frontend Integration**: Plugins can replace core UI components via manifest
- **Hot Loading**: Frontend uses React lazy loading for dynamic plugin imports
- **Error Isolation**: ErrorBoundary prevents plugin crashes from breaking the app

#### Plugin Discovery Flow

```
1. Backend startup → load_plugins() in backend/main.py
2. Scan /plugins directory for subdirectories
3. Look for main.py (legacy) or backend/main.py (new structure)
4. Import module and check for `router` attribute
5. Mount router at /plugins/{plugin_name}
6. Register plugin manifest (plugin.json) if exists
7. Frontend fetches /plugins endpoint to get plugin list
8. Frontend loads plugin components dynamically via lazy()
```

### 2. Manifest-Driven Architecture

Each plugin has an optional `plugin.json` manifest:

```json
{
  "name": "jira",
  "displayName": "Jira Integration",
  "replaces": "tasks",
  "frontendComponent": "JiraTasks"
}
```

**Manifest Fields:**
- `name`: Plugin identifier (must match directory name)
- `displayName`: Human-readable name for UI
- `replaces`: Core component to replace (e.g., "tasks")
- `frontendComponent`: React component filename (without .jsx)

### 3. Component Replacement System

Plugins can replace core UI sections using the `replaces` field:

```javascript
// In App.jsx
const tasksPlugin = plugins.find(p => p.manifest?.replaces === 'tasks');

// Render plugin component if it replaces "tasks"
{activeTab === 'tasks' && (
  tasksPlugin ?
    <PluginComponent plugin={tasksPlugin} /> :
    <DefaultTasksView />
)}
```

### 4. Error Boundaries & Lazy Loading

All plugin components are wrapped in ErrorBoundary and loaded lazily:

```javascript
const PluginComponent = ({ plugin, props }) => {
  // Cache component to prevent duplicate loads
  if (!componentCache[plugin.name]) {
    componentCache[plugin.name] = lazy(() =>
      import(`./plugins/${plugin.name}/${plugin.manifest.frontendComponent}`)
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Component {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};
```

### 5. API Structure

```
Core APIs:
  GET  /                        # Welcome message
  GET  /tasks                   # List all tasks
  POST /tasks                   # Create new task
  POST /agents/ask              # Chat with GPT-4
  POST /agents/analyze-tasks    # AI task analysis
  GET  /plugins                 # List all plugins with manifests

Plugin APIs:
  /plugins/{plugin_name}/*      # Plugin-specific endpoints

Example (Jira):
  GET  /plugins/jira/issues
  POST /plugins/jira/issues/{key}/status
  GET  /plugins/jira/issues/{key}/comments
  POST /plugins/jira/issues/{key}/comments
```

---

## Development Workflows

### Initial Setup

```bash
# 1. Backend setup
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your API keys

# 2. Frontend setup
cd frontend
npm install

# 3. Create plugin symlinks (if needed)
cd frontend/src/plugins
ln -s ../../../plugins/jira/frontend jira
```

### Running the Application

```bash
# Terminal 1: Start backend
cd backend
python main.py
# Server runs at http://localhost:8000

# Terminal 2: Start frontend
cd frontend
npm run dev
# Dev server runs at http://localhost:5173
```

### Development Cycle

1. **Backend Changes**:
   - Edit files in `backend/` or `plugins/*/backend/`
   - Restart server manually or use `uvicorn --reload`
   - Test endpoints with curl or Postman

2. **Frontend Changes**:
   - Edit files in `frontend/src/`
   - Vite HMR automatically reloads the browser
   - Check browser console for errors

3. **Plugin Development**:
   - Create new directory in `/plugins/{name}`
   - Add `backend/main.py` with FastAPI router
   - Add `frontend/{Component}.jsx` for UI
   - Add `plugin.json` manifest
   - Create symlink in `frontend/src/plugins/`
   - Restart backend to load plugin

### Git Workflow

```bash
# Current branch
git status
# You're on: claude/add-claude-documentation-iNaPz

# Make changes
git add .
git commit -m "feat: add new plugin system feature"

# Push to remote
git push -u origin claude/add-claude-documentation-iNaPz

# Note: Branch names must start with 'claude/' for CI/CD
```

---

## Code Conventions

### Python (Backend)

#### File Organization

- **One router per plugin**: Each plugin exports a single `router` object
- **Pydantic models**: Always use for request/response validation
- **Async functions**: Prefer `async def` for all endpoints
- **Environment variables**: Load with `python-dotenv` and `os.getenv()`

#### Naming Conventions

```python
# Files: snake_case
main.py, task_manager.py

# Classes: PascalCase
class Task(BaseModel):
    pass

# Functions/variables: snake_case
async def get_tasks():
    db_tasks = []

# Constants: UPPER_SNAKE_CASE
API_BASE_URL = "http://localhost:8000"
```

#### Code Style

```python
# Import order
import os                          # Standard library
import importlib.util
from typing import List, Optional  # typing module

from fastapi import FastAPI        # Third-party
from pydantic import BaseModel
import openai

from dotenv import load_dotenv     # Local imports (if any)

# Always use Pydantic models for validation
class Task(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str = "pending"

# Async all the way
@router.get("/tasks")
async def get_tasks():
    return db_tasks

# Environment variables with defaults
JIRA_JQL = os.getenv("JIRA_JQL", "order by created DESC")
```

#### Error Handling

```python
from fastapi import HTTPException

# Always validate environment variables
if not all([JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN]):
    raise HTTPException(status_code=400, detail="Jira credentials not configured")

# Provide detailed error messages
if response.status_code != 200:
    print(f"DEBUG JIRA ERROR: {response.status_code} - {response.text}")
    raise HTTPException(status_code=response.status_code, detail=f"Jira API Error: {response.text}")
```

### JavaScript/React (Frontend)

#### File Organization

- **One component per file**: Each `.jsx` file exports a single component
- **Functional components only**: No class components
- **Hooks at the top**: `useState`, `useEffect` before other logic
- **Helper functions inside component**: Keep component-specific logic encapsulated

#### Naming Conventions

```javascript
// Files: PascalCase for components
App.jsx, JiraTasks.jsx

// Components: PascalCase
function App() {}
const PluginComponent = ({ plugin }) => {}

// Variables/functions: camelCase
const activeTab = 'dashboard';
const fetchTasks = async () => {}

// Constants: UPPER_SNAKE_CASE
const API_BASE = 'http://localhost:8000';
```

#### Code Style

```javascript
// Import order
import React, { useState, useEffect } from 'react';  // React imports
import SomeLibrary from 'some-library';              // Third-party
import './App.css';                                  // Local styles

// Functional components with hooks
function App() {
  // 1. State hooks
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tasks, setTasks] = useState([]);

  // 2. Effect hooks
  useEffect(() => {
    fetchTasks();
  }, []);

  // 3. Helper functions
  const fetchTasks = async () => {
    // ...
  };

  // 4. Render
  return (
    <div>...</div>
  );
}

// Export at bottom
export default App;
```

#### React Patterns

```javascript
// Lazy loading plugins
const componentCache = {};
const Component = lazy(() => import(`./plugins/${name}/${component}`));

// Error boundaries for plugins
<ErrorBoundary>
  <Suspense fallback={<Loading />}>
    <PluginComponent />
  </Suspense>
</ErrorBoundary>

// Conditional rendering
{tasksPlugin ? (
  <PluginComponent plugin={tasksPlugin} />
) : (
  <DefaultTasksView />
)}

// Array mapping with keys
{tasks.map((task) => (
  <div key={task.id}>
    {task.title}
  </div>
))}
```

### CSS (Tailwind)

#### Design System

The project uses a custom design system defined in `frontend/src/index.css`:

```css
/* Color Variables */
--color-bg-dark: #0a0e1a;           /* Main background */
--color-bg-card: rgba(15, 23, 42, 0.6);  /* Card background */
--color-glass: rgba(30, 41, 59, 0.5);    /* Glass effect */
--color-text-main: #e2e8f0;         /* Primary text */
--color-text-muted: #94a3b8;        /* Secondary text */
--color-primary: #6366f1;           /* Primary accent */
--color-accent: #a855f7;            /* Secondary accent */
```

#### Tailwind Conventions

```javascript
// Glass-morphism pattern
className="bg-glass backdrop-blur-xl border border-glass-border rounded-2xl"

// Hover effects with transform
className="transition-all duration-300 hover:scale-[1.02] hover:border-primary"

// Button pattern
className="bg-primary text-white p-3 px-6 rounded-xl font-semibold cursor-pointer transition-all duration-300 hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(99,102,241,0.4)]"

// Card pattern
className="bg-bg-card backdrop-blur-xl border border-glass-border rounded-[24px] p-8 shadow-2xl"
```

---

## Plugin System Guide

### Creating a New Plugin

#### Step 1: Create Plugin Directory

```bash
mkdir -p plugins/my-plugin/backend
mkdir -p plugins/my-plugin/frontend
```

#### Step 2: Create Backend Router

**`plugins/my-plugin/backend/main.py`**:

```python
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class MyData(BaseModel):
    message: str

@router.get("/hello")
async def hello():
    return {"message": "Hello from my-plugin!"}

@router.post("/echo")
async def echo(data: MyData):
    return {"echo": data.message}
```

#### Step 3: Create Frontend Component

**`plugins/my-plugin/frontend/MyComponent.jsx`**:

```javascript
import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

function MyComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/plugins/my-plugin/hello`)
      .then(res => res.json())
      .then(data => setData(data));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">My Plugin</h1>
      {data && <p>{data.message}</p>}
    </div>
  );
}

export default MyComponent;
```

#### Step 4: Create Plugin Manifest

**`plugins/my-plugin/plugin.json`**:

```json
{
  "name": "my-plugin",
  "displayName": "My Awesome Plugin",
  "frontendComponent": "MyComponent"
}
```

#### Step 5: Create Symlink (if using frontend component)

```bash
cd frontend/src/plugins
ln -s ../../../plugins/my-plugin/frontend my-plugin
```

#### Step 6: Restart Backend

```bash
cd backend
python main.py
```

### Plugin Patterns

#### Environment Variables

```python
import os
from dotenv import load_dotenv

load_dotenv()

MY_API_KEY = os.getenv("MY_API_KEY")
MY_API_URL = os.getenv("MY_API_URL", "https://default.com")
```

#### External API Calls

```python
import httpx
from fastapi import HTTPException

@router.get("/external-data")
async def get_external_data():
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{MY_API_URL}/endpoint")
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"API Error: {response.text}"
            )
        return response.json()
```

#### Replacing Core Components

To replace the default "tasks" view:

```json
{
  "name": "my-plugin",
  "displayName": "My Task Manager",
  "replaces": "tasks",
  "frontendComponent": "MyTasks"
}
```

Now when users click "Tasks" in the sidebar, they'll see your plugin component instead.

---

## API Patterns

### Request/Response Models

Always define Pydantic models:

```python
from pydantic import BaseModel
from typing import Optional, List

class Task(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str = "pending"

@app.post("/tasks", response_model=Task)
async def create_task(task: Task):
    task.id = str(len(db_tasks) + 1)
    db_tasks.append(task)
    return task
```

### OpenAI Integration

```python
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.post("/agents/ask")
async def ask_agent(messages: List[ChatMessage]):
    try:
        message_dicts = [{"role": m.role, "content": m.content} for m in messages]
        response = client.chat.completions.create(
            model="gpt-4",
            messages=message_dicts
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Frontend Patterns

### State Management

No external state library (Redux, Zustand). Use React hooks:

```javascript
function App() {
  const [tasks, setTasks] = useState([]);
  const [plugins, setPlugins] = useState([]);

  const fetchTasks = async () => {
    const res = await fetch(`${API_BASE}/tasks`);
    const data = await res.json();
    setTasks(data);
  };
}
```

### API Calls

```javascript
// GET request
const res = await fetch(`${API_BASE}/tasks`);
const data = await res.json();

// POST request
await fetch(`${API_BASE}/tasks`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title, description })
});
```

### Tab Navigation

```javascript
const [activeTab, setActiveTab] = useState('dashboard');

// Render based on active tab
{activeTab === 'dashboard' && <DashboardView />}
{activeTab === 'tasks' && <TasksView />}
```

### Plugin Component Loading

```javascript
// Component cache prevents duplicate imports
const componentCache = {};

const PluginComponent = ({ plugin, props }) => {
  if (!componentCache[plugin.name]) {
    componentCache[plugin.name] = lazy(() =>
      import(`./plugins/${plugin.name}/${plugin.manifest.frontendComponent}`)
    );
  }

  const Component = componentCache[plugin.name];

  return (
    <ErrorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
        <Component {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};
```

---

## Environment Configuration

### Backend Environment Variables

Create `backend/.env`:

```bash
# Required for AI features
OPENAI_API_KEY=sk-...

# Required for Jira plugin
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_JQL=project = MYPROJECT order by created DESC
```

### Environment Variable Loading

```python
from dotenv import load_dotenv
import os

load_dotenv()  # Loads from .env file

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
JIRA_URL = os.getenv("JIRA_URL")
```

### Frontend Configuration

API endpoint is hardcoded in `App.jsx`:

```javascript
const API_BASE = 'http://localhost:8000';
```

For production, update this to your deployed backend URL.

---

## Common Tasks

### Adding a New Core API Endpoint

**`backend/main.py`**:

```python
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
```

### Adding a New UI Component

**`frontend/src/components/MyComponent.jsx`**:

```javascript
import React from 'react';

function MyComponent({ title }) {
  return (
    <div className="bg-glass p-4 rounded-xl">
      <h3>{title}</h3>
    </div>
  );
}

export default MyComponent;
```

Import in `App.jsx`:

```javascript
import MyComponent from './components/MyComponent';
```

### Updating the Theme

**`frontend/src/index.css`**:

```css
:root {
  --color-primary: #your-color;  /* Update primary color */
}
```

### Debugging Plugin Loading

Check backend console:

```bash
# You should see:
Loaded router for plugin: jira from /path/to/plugins/jira/backend/main.py
```

Check frontend console:

```javascript
console.log(plugins);  // Should show loaded plugins
```

### Adding a New Dependency

Backend:

```bash
cd backend
pip install new-package
pip freeze > requirements.txt
```

Frontend:

```bash
cd frontend
npm install new-package
```

---

## Testing

### Current State

**No testing infrastructure exists yet.**

The project does not have:
- Unit tests
- Integration tests
- E2E tests
- Test configuration files

### Recommended Testing Setup

#### Backend Testing (Future)

```bash
pip install pytest pytest-asyncio httpx
```

**`backend/test_main.py`**:

```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "Welcome" in response.json()["message"]

@pytest.mark.asyncio
async def test_get_tasks():
    response = client.get("/tasks")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

#### Frontend Testing (Future)

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

**`frontend/src/App.test.jsx`**:

```javascript
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders SuperDashboard title', () => {
  render(<App />);
  expect(screen.getByText(/SuperDashboard/i)).toBeInTheDocument();
});
```

---

## Gotchas & Important Notes

### 1. Plugin Frontend Symlinks

Plugin frontend components must be symlinked to `frontend/src/plugins/`:

```bash
cd frontend/src/plugins
ln -s ../../../plugins/jira/frontend jira
```

Without this symlink, dynamic imports will fail:

```javascript
// This will fail if symlink doesn't exist
import(`./plugins/jira/JiraTasks`)
```

### 2. CORS Configuration

Backend allows all origins (`allow_origins=["*"]`). **Change this in production**:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend.com"],  # Restrict origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 3. No Database Persistence

All data is stored in-memory:

```python
db_tasks = []  # Lost on server restart
```

For production, add a database (PostgreSQL, MongoDB, etc.).

### 4. Plugin Loading Requires Restart

Backend plugins are loaded on startup. To load new plugins:

```bash
# Stop server (Ctrl+C)
python backend/main.py  # Restart
```

Frontend plugins load dynamically (no restart needed).

### 5. Environment Variables

OpenAI and Jira features require environment variables. Without them:

```python
if not client.api_key:
    return {"error": "OpenAI API key not set"}
```

Always set `.env` before starting the backend.

### 6. Jira API Format

Jira uses Atlassian Document Format (ADF) for descriptions:

```python
# Complex nested structure
description = desc["content"][0]["content"][0]["text"]
```

Always handle parsing errors with try/except.

### 7. React 19 Features

This project uses React 19, which has some differences from React 18:

- No automatic batching changes
- New `use` hook available
- Improved Suspense behavior

### 8. Tailwind CSS v4

Uses the new `@tailwindcss/vite` plugin:

```javascript
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

No `tailwind.config.js` file needed (uses inline config in CSS).

### 9. FastAPI Router Mounting

Plugins must export a `router` variable:

```python
router = APIRouter()  # Must be named "router"

@router.get("/endpoint")
async def my_endpoint():
    pass
```

Backend checks `hasattr(module, "router")` before mounting.

### 10. Error Boundary Scope

ErrorBoundary only catches errors in plugin components. Core app errors are not caught. Consider adding a top-level ErrorBoundary for production.

---

## Quick Reference

### File Locations

| What | Where |
|------|-------|
| Backend entry point | `backend/main.py` |
| Frontend entry point | `frontend/src/main.jsx` |
| Main app component | `frontend/src/App.jsx` |
| Theme variables | `frontend/src/index.css` |
| Backend dependencies | `backend/requirements.txt` |
| Frontend dependencies | `frontend/package.json` |
| Plugin manifests | `plugins/*/plugin.json` |
| Environment variables | `backend/.env` |

### Common Commands

```bash
# Backend
cd backend && python main.py              # Start server
pip install -r requirements.txt           # Install dependencies

# Frontend
cd frontend && npm run dev                # Start dev server
npm run build                             # Production build
npm run lint                              # Run ESLint

# Git
git status                                # Check branch
git add . && git commit -m "..."          # Commit changes
git push -u origin branch-name            # Push to remote
```

### API Endpoints

```
GET  /                                    # Health check
GET  /tasks                               # List tasks
POST /tasks                               # Create task
POST /agents/ask                          # Chat with AI
POST /agents/analyze-tasks                # Analyze tasks
GET  /plugins                             # List plugins
GET  /plugins/{name}/*                    # Plugin endpoints
```

---

## Recent Changes (Git History)

```
9184f95 - Centralize .gitignore and clean up repository
d295258 - Update OpenAI client to 1.x and refine Jira API integration
79483bd - Complete Jira decoupling: self-contained plugin, manifest-driven
e5ba2ac - Restructure Jira plugin into separate backend/ and frontend
d8859f7 - Implement Jira plugin with JQL sync and comment editing
```

The project has been evolving toward a cleaner plugin architecture with better separation of concerns.

---

## Future Improvements

### Recommended Enhancements

1. **Add Database**: Replace in-memory storage with PostgreSQL/MongoDB
2. **Add Testing**: Implement pytest (backend) and Vitest (frontend)
3. **TypeScript Migration**: Convert frontend to TypeScript for type safety
4. **Authentication**: Add user authentication and authorization
5. **WebSocket Support**: Real-time updates for task changes
6. **Plugin Marketplace**: Allow users to install plugins from a registry
7. **Docker Support**: Add Dockerfile and docker-compose.yml
8. **CI/CD Pipeline**: Automated testing and deployment
9. **Logging**: Structured logging with levels and rotation
10. **Monitoring**: Add health checks and metrics endpoints

### Known Limitations

- No user authentication
- No data persistence
- No rate limiting
- No request validation beyond Pydantic
- No automated tests
- CORS allows all origins
- No error tracking (Sentry, etc.)
- No performance monitoring

---

## Contributing Guidelines

### Before Making Changes

1. **Read this document** thoroughly
2. **Understand the plugin system** before adding features
3. **Check existing patterns** in the codebase
4. **Test locally** before committing
5. **Follow code conventions** outlined above

### Making Changes

1. **One feature per commit**: Keep commits focused
2. **Write descriptive commit messages**: `feat: add user authentication`
3. **Don't break existing plugins**: Maintain backward compatibility
4. **Update this document**: If you change architecture or conventions
5. **Test both frontend and backend**: Ensure full integration works

### Code Review Checklist

- [ ] Follows existing code conventions
- [ ] No hardcoded secrets or API keys
- [ ] Error handling is comprehensive
- [ ] CORS settings are appropriate
- [ ] Plugin system remains functional
- [ ] No breaking changes to core APIs
- [ ] Console logs removed (or made conditional)
- [ ] Dependencies updated in requirements.txt/package.json

---

## Support & Resources

### Documentation

- **FastAPI**: https://fastapi.tiangolo.com/
- **React**: https://react.dev/
- **Vite**: https://vitejs.dev/
- **Tailwind CSS**: https://tailwindcss.com/
- **Pydantic**: https://docs.pydantic.dev/

### APIs Used

- **OpenAI API**: https://platform.openai.com/docs/
- **Jira REST API v3**: https://developer.atlassian.com/cloud/jira/platform/rest/v3/

### Project Contacts

- **License**: MIT (see LICENSE file)
- **Copyright**: 2025 Chris Chan
- **Repository**: Check git remote for URL

---

## Appendix: Plugin Structure Reference

### Minimal Plugin (Backend Only)

```
plugins/my-plugin/
└── main.py                    # Legacy structure
```

### Full Plugin (New Structure)

```
plugins/my-plugin/
├── backend/
│   └── main.py               # FastAPI router
├── frontend/
│   └── MyComponent.jsx       # React component
└── plugin.json               # Manifest
```

### Plugin Manifest Schema

```json
{
  "name": "string (required)",
  "displayName": "string (optional)",
  "replaces": "string (optional)",
  "frontendComponent": "string (optional, required if has frontend)"
}
```

---

**End of CLAUDE.md**

*This document should be updated whenever significant architectural changes are made to the SuperDashboard project.*
