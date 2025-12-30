# DevContainer Setup for SuperDashboard

This directory contains the DevContainer configuration for the SuperDashboard project.

## What's Included

- **devcontainer.json**: VS Code DevContainer configuration with recommended extensions
- **Dockerfile**: Development environment with Python 3.11 and Node.js 20
- **docker-compose.yml**: Multi-service setup for the development workspace

## Features

- ✅ Python 3.11 with pip
- ✅ Node.js 20 with npm
- ✅ Git and GitHub CLI
- ✅ Claude Code CLI (Anthropic's AI coding assistant)
- ✅ VS Code extensions for Python, React, and Tailwind CSS
- ✅ Port forwarding for backend (8000) and frontend (5173)
- ✅ Automatic dependency installation on container creation
- ✅ Persistent volumes for faster rebuilds

## Getting Started

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Install [VS Code](https://code.visualstudio.com/) with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
3. Open this project in VS Code
4. When prompted, click "Reopen in Container" (or use Command Palette: "Dev Containers: Reopen in Container")
5. Wait for the container to build and dependencies to install

## Running the Application

Once inside the container:

### Start Backend
```bash
cd backend
python main.py
```
Backend will be available at http://localhost:8000

### Start Frontend
```bash
cd frontend
npm run dev
```
Frontend will be available at http://localhost:5173

### Using Claude Code CLI
```bash
# First time: Login to Claude
claude login

# Start an interactive session
claude

# Or run a specific command
claude "add error handling to the backend API"
```

Claude Code CLI is an AI coding assistant that can:
- Understand your codebase
- Edit files and execute commands
- Manage Git workflows
- Answer coding questions

Your Claude authentication will persist across container rebuilds.

## Environment Variables

Make sure to copy `backend/.env.example` to `backend/.env` and configure your API keys:

```bash
cp backend/.env.example backend/.env
```

Then edit `backend/.env` with your actual credentials.

## Troubleshooting

### Container won't start
- Make sure Docker Desktop is running
- Try rebuilding the container: Command Palette → "Dev Containers: Rebuild Container"

### Dependencies not installed
- Run the post-create command manually:
  ```bash
  cd backend && pip install -r requirements.txt && cd ../frontend && npm install
  ```

### Ports already in use
- Stop any local servers running on ports 8000 or 5173
- Or modify the port mappings in `docker-compose.yml`
