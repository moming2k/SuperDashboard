from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import subprocess
import os
import json
import httpx

router = APIRouter()

class CommandRequest(BaseModel):
    command: str
    args: Optional[List[str]] = []
    cwd: Optional[str] = None

class CommandResponse(BaseModel):
    success: bool
    output: str
    error: Optional[str] = None

class JiraTicketRequest(BaseModel):
    project: str
    summary: str
    description: Optional[str] = None
    issue_type: str = "Task"

def run_command(command: List[str], cwd: Optional[str] = None) -> CommandResponse:
    """Execute a shell command and return the result"""
    try:
        # Use the project root as default working directory
        if not cwd:
            cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))

        result = subprocess.run(
            command,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=30
        )

        output = result.stdout if result.stdout else result.stderr

        return CommandResponse(
            success=result.returncode == 0,
            output=output.strip(),
            error=result.stderr.strip() if result.returncode != 0 else None
        )
    except subprocess.TimeoutExpired:
        return CommandResponse(
            success=False,
            output="",
            error="Command timed out after 30 seconds"
        )
    except Exception as e:
        return CommandResponse(
            success=False,
            output="",
            error=str(e)
        )

# Git Operations
@router.get("/git/status")
async def git_status():
    """Get git status"""
    result = run_command(["git", "status", "--short"])
    return result

@router.get("/git/log")
async def git_log():
    """Get recent git commits"""
    result = run_command(["git", "log", "--oneline", "-n", "10"])
    return result

@router.get("/git/branches")
async def git_branches():
    """List all git branches"""
    result = run_command(["git", "branch", "-a"])
    return result

@router.post("/git/pull")
async def git_pull():
    """Pull latest changes from remote"""
    result = run_command(["git", "pull"])
    return result

@router.post("/git/push")
async def git_push():
    """Push commits to remote"""
    result = run_command(["git", "push"])
    return result

@router.post("/git/commit")
async def git_commit(message: str):
    """Create a git commit"""
    # First stage all changes
    stage_result = run_command(["git", "add", "."])
    if not stage_result.success:
        return stage_result

    # Then commit
    result = run_command(["git", "commit", "-m", message])
    return result

@router.post("/git/checkout")
async def git_checkout(branch: str, create: bool = False):
    """Checkout a git branch"""
    if create:
        result = run_command(["git", "checkout", "-b", branch])
    else:
        result = run_command(["git", "checkout", branch])
    return result

# Build and Test Commands
@router.post("/build/frontend")
async def build_frontend():
    """Build the frontend application"""
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../frontend'))
    result = run_command(["npm", "run", "build"], cwd=frontend_dir)
    return result

@router.post("/build/install-frontend")
async def install_frontend_deps():
    """Install frontend dependencies"""
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../frontend'))
    result = run_command(["npm", "install"], cwd=frontend_dir)
    return result

@router.post("/build/install-backend")
async def install_backend_deps():
    """Install backend dependencies"""
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../backend'))
    result = run_command(["pip", "install", "-r", "requirements.txt"], cwd=backend_dir)
    return result

@router.post("/test/frontend")
async def test_frontend():
    """Run frontend tests"""
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../frontend'))
    result = run_command(["npm", "test"], cwd=frontend_dir)
    return result

@router.post("/test/backend")
async def test_backend():
    """Run backend tests"""
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../backend'))
    result = run_command(["pytest"], cwd=backend_dir)
    return result

@router.post("/lint/frontend")
async def lint_frontend():
    """Run ESLint on frontend"""
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../frontend'))
    result = run_command(["npm", "run", "lint"], cwd=frontend_dir)
    return result

# Jira Ticket Creation
@router.post("/jira/create-ticket")
async def create_jira_ticket(ticket: JiraTicketRequest):
    """Create a Jira ticket"""
    import httpx
    from dotenv import load_dotenv

    load_dotenv()

    JIRA_URL = os.getenv("JIRA_URL")
    JIRA_EMAIL = os.getenv("JIRA_EMAIL")
    JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")

    if not all([JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN]):
        raise HTTPException(
            status_code=400,
            detail="Jira credentials not configured. Please set JIRA_URL, JIRA_EMAIL, and JIRA_API_TOKEN in .env"
        )

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{JIRA_URL}/rest/api/3/issue",
            auth=(JIRA_EMAIL, JIRA_API_TOKEN),
            json={
                "fields": {
                    "project": {"key": ticket.project},
                    "summary": ticket.summary,
                    "description": {
                        "type": "doc",
                        "version": 1,
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [
                                    {
                                        "type": "text",
                                        "text": ticket.description or ""
                                    }
                                ]
                            }
                        ]
                    },
                    "issuetype": {"name": ticket.issue_type}
                }
            }
        )

        if response.status_code != 201:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Jira API Error: {response.text}"
            )

        data = response.json()
        return {
            "success": True,
            "key": data.get("key"),
            "url": f"{JIRA_URL}/browse/{data.get('key')}"
        }

# Documentation Search
@router.get("/docs/search")
async def search_docs(query: str):
    """Search through project documentation files"""
    try:
        # Search for markdown files and README files
        search_patterns = ["*.md", "README*", "CLAUDE.md"]
        results = []

        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))

        for pattern in search_patterns:
            find_result = run_command(
                ["find", ".", "-name", pattern, "-type", "f"],
                cwd=project_root
            )

            if find_result.success and find_result.output:
                files = find_result.output.split('\n')

                for file_path in files:
                    if not file_path:
                        continue

                    # Read file and search for query
                    full_path = os.path.join(project_root, file_path.lstrip('./'))
                    try:
                        with open(full_path, 'r', encoding='utf-8') as f:
                            content = f.read()

                        # Case-insensitive search
                        if query.lower() in content.lower():
                            # Find matching lines
                            lines = content.split('\n')
                            matches = []
                            for i, line in enumerate(lines):
                                if query.lower() in line.lower():
                                    matches.append({
                                        "line": i + 1,
                                        "content": line.strip()
                                    })
                                    if len(matches) >= 3:  # Limit to 3 matches per file
                                        break

                            results.append({
                                "file": file_path,
                                "matches": matches
                            })
                    except Exception as e:
                        continue

        return {
            "success": True,
            "query": query,
            "results": results[:10]  # Limit to top 10 files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get available commands list
@router.get("/commands")
async def get_commands():
    """Get list of all available commands from all plugins"""
    all_commands = []

    # Add built-in commands from this plugin
    built_in_commands = [
            {
                "id": "git.status",
                "label": "Git: Show Status",
                "description": "Show the working tree status",
                "category": "Git",
                "icon": "📊"
            },
            {
                "id": "git.log",
                "label": "Git: Show Recent Commits",
                "description": "Display recent commit history",
                "category": "Git",
                "icon": "📜"
            },
            {
                "id": "git.branches",
                "label": "Git: List Branches",
                "description": "Show all local and remote branches",
                "category": "Git",
                "icon": "🌳"
            },
            {
                "id": "git.pull",
                "label": "Git: Pull",
                "description": "Fetch and integrate changes from remote",
                "category": "Git",
                "icon": "⬇️"
            },
            {
                "id": "git.push",
                "label": "Git: Push",
                "description": "Push commits to remote repository",
                "category": "Git",
                "icon": "⬆️"
            },
            {
                "id": "git.commit",
                "label": "Git: Commit All Changes",
                "description": "Stage and commit all changes",
                "category": "Git",
                "icon": "💾"
            },
            {
                "id": "git.checkout",
                "label": "Git: Checkout Branch",
                "description": "Switch to a different branch",
                "category": "Git",
                "icon": "🔀"
            },
            {
                "id": "build.frontend",
                "label": "Build: Frontend",
                "description": "Build the frontend application",
                "category": "Build",
                "icon": "🏗️"
            },
            {
                "id": "build.install-frontend",
                "label": "Install: Frontend Dependencies",
                "description": "Run npm install for frontend",
                "category": "Build",
                "icon": "📦"
            },
            {
                "id": "build.install-backend",
                "label": "Install: Backend Dependencies",
                "description": "Install Python packages from requirements.txt",
                "category": "Build",
                "icon": "📦"
            },
            {
                "id": "test.frontend",
                "label": "Test: Frontend",
                "description": "Run frontend tests",
                "category": "Test",
                "icon": "🧪"
            },
            {
                "id": "test.backend",
                "label": "Test: Backend",
                "description": "Run backend tests with pytest",
                "category": "Test",
                "icon": "🧪"
            },
            {
                "id": "lint.frontend",
                "label": "Lint: Frontend",
                "description": "Run ESLint on frontend code",
                "category": "Lint",
                "icon": "✨"
            },
            {
                "id": "jira.create",
                "label": "Jira: Create Ticket",
                "description": "Create a new Jira issue",
                "category": "Jira",
                "icon": "🎫"
            },
            {
                "id": "docs.search",
                "label": "Docs: Search Documentation",
                "description": "Search through project documentation",
                "category": "Docs",
                "icon": "🔍"
            }
        ]

    all_commands.extend(built_in_commands)

    # Fetch commands from all other plugins
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Get list of all plugins
            try:
                plugins_response = await client.get("http://localhost:8000/plugins")
                if plugins_response.status_code == 200:
                    plugins = plugins_response.json()

                    for plugin in plugins:
                        # Skip command-palette itself and disabled plugins
                        if plugin.get("name") == "command-palette" or not plugin.get("enabled", False):
                            continue

                        plugin_name = plugin.get("name")

                        # Try to fetch commands from this plugin
                        try:
                            commands_response = await client.get(
                                f"http://localhost:8000/plugins/{plugin_name}/commands"
                            )

                            if commands_response.status_code == 200:
                                plugin_commands_data = commands_response.json()
                                plugin_commands = plugin_commands_data.get("commands", [])

                                # Namespace each command with plugin name
                                for cmd in plugin_commands:
                                    # Add plugin namespace to command ID
                                    cmd["id"] = f"{plugin_name}.{cmd.get('id', '')}"
                                    # Store plugin name for routing
                                    cmd["pluginName"] = plugin_name

                                all_commands.extend(plugin_commands)
                        except Exception as e:
                            # Skip plugins that don't have /commands endpoint
                            print(f"Could not fetch commands from {plugin_name}: {str(e)}")
                            continue
            except Exception as e:
                print(f"Could not fetch plugins list: {str(e)}")
    except Exception as e:
        print(f"Error fetching plugin commands: {str(e)}")

    return {
        "commands": all_commands
    }
