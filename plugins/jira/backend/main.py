import os
import httpx
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

JIRA_URL = os.getenv("JIRA_URL")
JIRA_EMAIL = os.getenv("JIRA_EMAIL")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")
JIRA_JQL = os.getenv("JIRA_JQL", "order by created DESC")

auth = (JIRA_EMAIL, JIRA_API_TOKEN)

class JiraComment(BaseModel):
    id: str
    body: str
    author: str
    created: str

class JiraIssue(BaseModel):
    key: str
    summary: str
    description: Optional[str] = None
    status: str
    priority: str
    assignee: Optional[str] = None
    created: str
    updated: str

@router.get("/issues", response_model=List[JiraIssue])
async def get_jira_issues():
    if not all([JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN]):
        raise HTTPException(status_code=400, detail="Jira credentials not configured")
    
    url = f"{JIRA_URL}/rest/api/3/search/jql"
    # Using POST for search as suggested by the migration message
    payload = {
        "jql": JIRA_JQL,
        "fields": ["summary", "description", "status", "priority", "assignee", "created", "updated"],
        "maxResults": 50
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, auth=auth)
        if response.status_code != 200:
            # Handle potential 410 or other errors with clear info
            print(f"DEBUG JIRA ERROR: {response.status_code} - {response.text}")
            raise HTTPException(status_code=response.status_code, detail=f"Jira API Error: {response.text}")
        
        data = response.json()
        issues = []
        for issue in data.get("issues", []):
            fields = issue["fields"]
            
            # Helper to get description text (Jira ADF format handling)
            description_text = ""
            desc = fields.get("description")
            if desc and isinstance(desc, dict):
                # Simple extraction from ADF
                try:
                    description_text = desc.get("content", [{}])[0].get("content", [{}])[0].get("text", "")
                except (IndexError, KeyError):
                    description_text = str(desc) # Fallback to raw string if parsing fails
            
            issues.append(JiraIssue(
                key=issue["key"],
                summary=fields["summary"],
                description=description_text,
                status=fields["status"]["name"],
                priority=fields["priority"]["name"],
                assignee=fields["assignee"]["displayName"] if fields.get("assignee") else "Unassigned",
                created=fields["created"],
                updated=fields["updated"]
            ))
        return issues

@router.post("/issues/{issue_key}/status")
async def update_issue_status(issue_key: str, status_name: str = Body(..., embed=True)):
    # In Jira, we need to find the transition ID for the status name
    url = f"{JIRA_URL}/rest/api/3/issue/{issue_key}/transitions"
    
    async with httpx.AsyncClient() as client:
        # Get available transitions
        res = await client.get(url, auth=auth)
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        
        transitions = res.json().get("transitions", [])
        transition_id = next((t["id"] for t in transitions if t["name"].lower() == status_name.lower()), None)
        
        if not transition_id:
            raise HTTPException(status_code=400, detail=f"Transition to '{status_name}' not found for issue {issue_key}")
        
        # Perform transition
        payload = {"transition": {"id": transition_id}}
        res = await client.post(url, json=payload, auth=auth)
        if res.status_code not in [204, 200]:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        
        return {"message": f"Status updated to {status_name}"}

@router.get("/issues/{issue_key}/comments", response_model=List[JiraComment])
async def get_comments(issue_key: str):
    url = f"{JIRA_URL}/rest/api/3/issue/{issue_key}/comment"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, auth=auth)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        
        data = response.json()
        comments = []
        for c in data.get("comments", []):
            comments.append(JiraComment(
                id=c["id"],
                body=c["body"]["content"][0]["content"][0]["text"] if c["body"].get("content") else "",
                author=c["author"]["displayName"],
                created=c["created"]
            ))
        return comments

@router.post("/issues/{issue_key}/comments")
async def add_comment(issue_key: str, body: str = Body(..., embed=True)):
    url = f"{JIRA_URL}/rest/api/3/issue/{issue_key}/comment"
    payload = {
        "body": {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": body}]
                }
            ]
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, auth=auth)
        if response.status_code != 201:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return {"message": "Comment added"}

# Command Palette Integration
@router.get("/commands")
async def get_commands():
    """Return commands that this plugin provides to the Command Palette"""
    return {
        "commands": [
            {
                "id": "sync-issues",
                "label": "Jira: Sync Issues",
                "description": "Fetch latest issues from Jira using configured JQL",
                "category": "Jira",
                "icon": "🔄",
                "endpoint": "/issues",
                "method": "GET",
                "requiresInput": False
            },
            {
                "id": "create-ticket",
                "label": "Jira: Create Ticket",
                "description": "Create a new Jira issue",
                "category": "Jira",
                "icon": "🎫",
                "endpoint": "/create-issue",
                "method": "POST",
                "requiresInput": True,
                "inputSchema": {
                    "type": "form",
                    "fields": [
                        {
                            "name": "project",
                            "label": "Project Key",
                            "type": "text",
                            "required": True,
                            "placeholder": "e.g., PROJ"
                        },
                        {
                            "name": "summary",
                            "label": "Summary",
                            "type": "text",
                            "required": True,
                            "placeholder": "Brief description of the issue"
                        },
                        {
                            "name": "description",
                            "label": "Description",
                            "type": "textarea",
                            "required": False,
                            "placeholder": "Detailed description (optional)"
                        },
                        {
                            "name": "issue_type",
                            "label": "Issue Type",
                            "type": "select",
                            "required": True,
                            "options": ["Task", "Bug", "Story", "Epic"]
                        }
                    ]
                }
            }
        ]
    }

# Create Jira Issue endpoint
class CreateIssueRequest(BaseModel):
    project: str
    summary: str
    description: Optional[str] = None
    issue_type: str = "Task"

@router.post("/create-issue")
async def create_jira_issue(request: CreateIssueRequest):
    """Create a new Jira issue"""
    if not all([JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN]):
        raise HTTPException(status_code=400, detail="Jira credentials not configured")

    url = f"{JIRA_URL}/rest/api/3/issue"

    # Build description in ADF format
    description_adf = {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {
                        "type": "text",
                        "text": request.description or ""
                    }
                ]
            }
        ]
    } if request.description else None

    payload = {
        "fields": {
            "project": {"key": request.project},
            "summary": request.summary,
            "issuetype": {"name": request.issue_type}
        }
    }

    if description_adf:
        payload["fields"]["description"] = description_adf

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, auth=auth)
        if response.status_code != 201:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Jira API Error: {response.text}"
            )

        data = response.json()
        return {
            "success": True,
            "key": data.get("key"),
            "url": f"{JIRA_URL}/browse/{data.get('key')}",
            "message": f"Created issue {data.get('key')}"
        }
