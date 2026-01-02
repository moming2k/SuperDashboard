from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid
import copy

router = APIRouter()

# Enums
class SnippetVisibility(str, Enum):
    PERSONAL = "personal"
    TEAM = "team"
    PUBLIC = "public"

class SnippetLanguage(str, Enum):
    # Programming Languages
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    JAVA = "java"
    CSHARP = "csharp"
    CPP = "cpp"
    C = "c"
    GO = "go"
    RUST = "rust"
    PHP = "php"
    RUBY = "ruby"
    SWIFT = "swift"
    KOTLIN = "kotlin"
    SCALA = "scala"
    R = "r"
    MATLAB = "matlab"
    PERL = "perl"
    LUA = "lua"
    HASKELL = "haskell"
    ELIXIR = "elixir"
    ERLANG = "erlang"
    CLOJURE = "clojure"

    # Web Technologies
    HTML = "html"
    CSS = "css"
    SCSS = "scss"
    LESS = "less"
    JSX = "jsx"
    TSX = "tsx"
    VUE = "vue"

    # Shell/Scripting
    BASH = "bash"
    SHELL = "shell"
    POWERSHELL = "powershell"
    BATCH = "batch"

    # Data/Config
    JSON = "json"
    YAML = "yaml"
    XML = "xml"
    SQL = "sql"
    GRAPHQL = "graphql"

    # Documentation
    MARKDOWN = "markdown"
    LATEX = "latex"
    RST = "rst"

    # Other
    DOCKER = "dockerfile"
    MAKEFILE = "makefile"
    CMAKE = "cmake"
    TERRAFORM = "terraform"
    NGINX = "nginx"
    APACHE = "apache"
    REGEX = "regex"
    PLAINTEXT = "plaintext"

# Pydantic Models
class SnippetVersion(BaseModel):
    version: int
    code: str
    description: Optional[str] = None
    created_at: str
    created_by: Optional[str] = "system"

class Snippet(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = None
    code: str
    language: SnippetLanguage
    visibility: SnippetVisibility = SnippetVisibility.PERSONAL
    tags: List[str] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    created_by: Optional[str] = "current_user"
    favorite: bool = False
    use_count: int = 0
    versions: List[SnippetVersion] = []

class SnippetUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    code: Optional[str] = None
    language: Optional[SnippetLanguage] = None
    visibility: Optional[SnippetVisibility] = None
    tags: Optional[List[str]] = None
    favorite: Optional[bool] = None

class Tag(BaseModel):
    name: str
    count: int
    color: Optional[str] = None

# In-memory storage (replace with database in production)
snippets_db: List[Snippet] = []
tags_db: Dict[str, Tag] = {}

# Initialize with some example snippets
def initialize_example_snippets():
    """Add some example snippets for demonstration"""
    examples = [
        Snippet(
            id=str(uuid.uuid4()),
            title="FastAPI Route Handler",
            description="Basic FastAPI route with error handling",
            code="""@app.get("/items/{item_id}")
async def read_item(item_id: int):
    try:
        item = await get_item(item_id)
        return {"item": item}
    except ItemNotFound:
        raise HTTPException(status_code=404, detail="Item not found")""",
            language=SnippetLanguage.PYTHON,
            visibility=SnippetVisibility.TEAM,
            tags=["fastapi", "python", "api"],
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat(),
            versions=[],
            favorite=False,
            use_count=0
        ),
        Snippet(
            id=str(uuid.uuid4()),
            title="React useState Hook",
            description="Basic useState hook with TypeScript",
            code="""const [count, setCount] = useState<number>(0);

const increment = () => {
  setCount(prev => prev + 1);
};

const decrement = () => {
  setCount(prev => prev - 1);
};""",
            language=SnippetLanguage.TYPESCRIPT,
            visibility=SnippetVisibility.TEAM,
            tags=["react", "typescript", "hooks"],
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat(),
            versions=[],
            favorite=True,
            use_count=5
        ),
        Snippet(
            id=str(uuid.uuid4()),
            title="SQL Join Query",
            description="Common SQL join pattern with filtering",
            code="""SELECT u.id, u.name, o.order_id, o.total
FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.status = 'completed'
  AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY o.created_at DESC
LIMIT 100;""",
            language=SnippetLanguage.SQL,
            visibility=SnippetVisibility.TEAM,
            tags=["sql", "database", "query"],
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat(),
            versions=[],
            favorite=False,
            use_count=3
        )
    ]

    for snippet in examples:
        snippets_db.append(snippet)
        for tag in snippet.tags:
            if tag not in tags_db:
                tags_db[tag] = Tag(name=tag, count=1)
            else:
                tags_db[tag].count += 1

# Initialize on startup
if not snippets_db:
    initialize_example_snippets()

# Helper Functions
def update_tags(old_tags: List[str], new_tags: List[str]):
    """Update tag counts when snippet tags change"""
    # Decrease count for removed tags
    for tag in old_tags:
        if tag not in new_tags and tag in tags_db:
            tags_db[tag].count -= 1
            if tags_db[tag].count <= 0:
                del tags_db[tag]

    # Increase count for new tags
    for tag in new_tags:
        if tag not in old_tags:
            if tag not in tags_db:
                tags_db[tag] = Tag(name=tag, count=1)
            else:
                tags_db[tag].count += 1

def create_version(snippet: Snippet) -> SnippetVersion:
    """Create a new version from current snippet state"""
    version_number = len(snippet.versions) + 1
    return SnippetVersion(
        version=version_number,
        code=snippet.code,
        description=f"Version {version_number}",
        created_at=datetime.utcnow().isoformat(),
        created_by=snippet.created_by or "system"
    )

# Snippet Endpoints
@router.get("/snippets")
async def get_snippets(
    visibility: Optional[str] = None,
    language: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    favorite: Optional[bool] = None,
    sort_by: str = "updated_at",
    limit: int = 100
):
    """Get all snippets with optional filtering"""
    filtered_snippets = snippets_db.copy()

    # Apply filters
    if visibility:
        filtered_snippets = [s for s in filtered_snippets if s.visibility == visibility]
    if language:
        filtered_snippets = [s for s in filtered_snippets if s.language == language]
    if tag:
        filtered_snippets = [s for s in filtered_snippets if tag in s.tags]
    if search:
        search_lower = search.lower()
        filtered_snippets = [
            s for s in filtered_snippets
            if search_lower in s.title.lower()
            or (s.description and search_lower in s.description.lower())
            or search_lower in s.code.lower()
            or any(search_lower in t.lower() for t in s.tags)
        ]
    if favorite is not None:
        filtered_snippets = [s for s in filtered_snippets if s.favorite == favorite]

    # Sort
    if sort_by == "updated_at":
        filtered_snippets.sort(key=lambda x: x.updated_at or "", reverse=True)
    elif sort_by == "created_at":
        filtered_snippets.sort(key=lambda x: x.created_at or "", reverse=True)
    elif sort_by == "title":
        filtered_snippets.sort(key=lambda x: x.title.lower())
    elif sort_by == "use_count":
        filtered_snippets.sort(key=lambda x: x.use_count, reverse=True)

    return filtered_snippets[:limit]

@router.get("/snippets/{snippet_id}")
async def get_snippet(snippet_id: str):
    """Get a specific snippet by ID"""
    snippet = next((s for s in snippets_db if s.id == snippet_id), None)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return snippet

@router.post("/snippets", response_model=Snippet)
async def create_snippet(snippet: Snippet):
    """Create a new snippet"""
    snippet.id = str(uuid.uuid4())
    snippet.created_at = datetime.utcnow().isoformat()
    snippet.updated_at = datetime.utcnow().isoformat()
    snippet.use_count = 0
    snippet.versions = []

    # Add tags to tag database
    for tag in snippet.tags:
        if tag not in tags_db:
            tags_db[tag] = Tag(name=tag, count=1)
        else:
            tags_db[tag].count += 1

    snippets_db.append(snippet)
    return snippet

@router.put("/snippets/{snippet_id}", response_model=Snippet)
async def update_snippet(snippet_id: str, update: SnippetUpdate):
    """Update a snippet and create a version if code changed"""
    snippet = next((s for s in snippets_db if s.id == snippet_id), None)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")

    # Save old tags for updating counts
    old_tags = snippet.tags.copy()

    # Create version if code is changing
    if update.code and update.code != snippet.code:
        version = create_version(snippet)
        snippet.versions.append(version)

    # Update fields
    if update.title:
        snippet.title = update.title
    if update.description is not None:
        snippet.description = update.description
    if update.code:
        snippet.code = update.code
    if update.language:
        snippet.language = update.language
    if update.visibility:
        snippet.visibility = update.visibility
    if update.tags is not None:
        snippet.tags = update.tags
        update_tags(old_tags, update.tags)
    if update.favorite is not None:
        snippet.favorite = update.favorite

    snippet.updated_at = datetime.utcnow().isoformat()

    return snippet

@router.delete("/snippets/{snippet_id}")
async def delete_snippet(snippet_id: str):
    """Delete a snippet"""
    global snippets_db
    snippet = next((s for s in snippets_db if s.id == snippet_id), None)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")

    # Update tag counts
    for tag in snippet.tags:
        if tag in tags_db:
            tags_db[tag].count -= 1
            if tags_db[tag].count <= 0:
                del tags_db[tag]

    snippets_db = [s for s in snippets_db if s.id != snippet_id]
    return {"message": "Snippet deleted"}

@router.post("/snippets/{snippet_id}/use")
async def increment_use_count(snippet_id: str):
    """Increment use count when snippet is copied/used"""
    snippet = next((s for s in snippets_db if s.id == snippet_id), None)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")

    snippet.use_count += 1
    return {"use_count": snippet.use_count}

@router.post("/snippets/{snippet_id}/favorite")
async def toggle_favorite(snippet_id: str):
    """Toggle favorite status of a snippet"""
    snippet = next((s for s in snippets_db if s.id == snippet_id), None)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")

    snippet.favorite = not snippet.favorite
    return {"favorite": snippet.favorite}

@router.get("/snippets/{snippet_id}/versions")
async def get_snippet_versions(snippet_id: str):
    """Get version history for a snippet"""
    snippet = next((s for s in snippets_db if s.id == snippet_id), None)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")

    return snippet.versions

@router.post("/snippets/{snippet_id}/versions/{version_number}/restore")
async def restore_version(snippet_id: str, version_number: int):
    """Restore a previous version of a snippet"""
    snippet = next((s for s in snippets_db if s.id == snippet_id), None)
    if not snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")

    version = next((v for v in snippet.versions if v.version == version_number), None)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Create a new version with current code before restoring
    current_version = create_version(snippet)
    snippet.versions.append(current_version)

    # Restore the old version
    snippet.code = version.code
    snippet.updated_at = datetime.utcnow().isoformat()

    return snippet

# Tag Endpoints
@router.get("/tags")
async def get_tags():
    """Get all tags with usage counts"""
    return list(tags_db.values())

@router.get("/tags/{tag_name}/snippets")
async def get_snippets_by_tag(tag_name: str):
    """Get all snippets with a specific tag"""
    return [s for s in snippets_db if tag_name in s.tags]

# Language Endpoints
@router.get("/languages")
async def get_supported_languages():
    """Get list of all supported languages"""
    return [
        {"value": lang.value, "label": lang.value.title()}
        for lang in SnippetLanguage
    ]

@router.get("/stats")
async def get_stats():
    """Get snippet statistics"""
    return {
        "total_snippets": len(snippets_db),
        "total_tags": len(tags_db),
        "personal_snippets": len([s for s in snippets_db if s.visibility == SnippetVisibility.PERSONAL]),
        "team_snippets": len([s for s in snippets_db if s.visibility == SnippetVisibility.TEAM]),
        "favorite_snippets": len([s for s in snippets_db if s.favorite]),
        "most_used_language": max(
            [(lang, len([s for s in snippets_db if s.language == lang]))
             for lang in set(s.language for s in snippets_db)],
            key=lambda x: x[1],
            default=(None, 0)
        )[0] if snippets_db else None,
        "total_versions": sum(len(s.versions) for s in snippets_db)
    }

# Command Palette Integration
@router.get("/commands")
async def get_commands():
    """Return commands that this plugin provides to the Command Palette"""
    return {
        "commands": [
            {
                "id": "create-snippet",
                "label": "Snippets: Create New",
                "description": "Create a new code snippet",
                "category": "Snippets",
                "icon": "📝",
                "endpoint": "/snippets",
                "method": "POST",
                "requiresInput": True,
                "inputSchema": {
                    "type": "form",
                    "fields": [
                        {
                            "name": "title",
                            "label": "Title",
                            "type": "text",
                            "required": True,
                            "placeholder": "Snippet title"
                        },
                        {
                            "name": "code",
                            "label": "Code",
                            "type": "textarea",
                            "required": True,
                            "placeholder": "Paste your code here..."
                        },
                        {
                            "name": "language",
                            "label": "Language",
                            "type": "select",
                            "required": True,
                            "options": ["python", "javascript", "typescript", "sql", "bash"]
                        }
                    ]
                }
            },
            {
                "id": "search-snippets",
                "label": "Snippets: Search",
                "description": "Search through your snippets",
                "category": "Snippets",
                "icon": "🔍",
                "endpoint": "/snippets",
                "method": "GET",
                "requiresInput": False
            },
            {
                "id": "view-favorites",
                "label": "Snippets: View Favorites",
                "description": "Show only favorite snippets",
                "category": "Snippets",
                "icon": "⭐",
                "endpoint": "/snippets?favorite=true",
                "method": "GET",
                "requiresInput": False
            }
        ]
    }

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "snippets_count": len(snippets_db),
        "tags_count": len(tags_db)
    }
