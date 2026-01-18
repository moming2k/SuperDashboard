from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from sqlalchemy.orm import Session
import uuid
import sys
import os

# Add parent directory to path to import from backend
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))
from backend.database import get_db
import backend.services as services

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

# Helper Functions
def db_snippet_to_pydantic(db_snippet, include_versions=False):
    """Convert database snippet to Pydantic model"""
    versions = []
    if include_versions:
        db_versions = services.get_snippet_versions(None, db_snippet.id)
        versions = [
            SnippetVersion(
                version=v.version,
                code=v.code,
                description=v.description,
                created_at=v.created_at.isoformat() if v.created_at else "",
                created_by=v.created_by
            )
            for v in db_versions
        ]
    
    return Snippet(
        id=db_snippet.id,
        title=db_snippet.title,
        description=db_snippet.description,
        code=db_snippet.code,
        language=SnippetLanguage(db_snippet.language),
        visibility=SnippetVisibility(db_snippet.visibility),
        tags=db_snippet.tags or [],
        created_at=db_snippet.created_at.isoformat() if db_snippet.created_at else None,
        updated_at=db_snippet.updated_at.isoformat() if db_snippet.updated_at else None,
        created_by=db_snippet.created_by,
        favorite=db_snippet.favorite,
        use_count=db_snippet.use_count,
        versions=versions
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
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all snippets with optional filtering"""
    db_snippets = services.get_snippets(
        db, visibility=visibility, language=language, tag=tag,
        search=search, favorite=favorite, sort_by=sort_by, limit=limit
    )
    return [db_snippet_to_pydantic(s) for s in db_snippets]

@router.get("/snippets/{snippet_id}")
async def get_snippet(snippet_id: str, db: Session = Depends(get_db)):
    """Get a specific snippet by ID"""
    db_snippet = services.get_snippet_by_id(db, snippet_id)
    if not db_snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return db_snippet_to_pydantic(db_snippet, include_versions=True)

@router.post("/snippets", response_model=Snippet)
async def create_snippet(snippet: Snippet, db: Session = Depends(get_db)):
    """Create a new snippet"""
    snippet_id = str(uuid.uuid4())
    
    db_snippet = services.create_snippet(
        db=db,
        snippet_id=snippet_id,
        title=snippet.title,
        description=snippet.description,
        code=snippet.code,
        language=snippet.language.value,
        visibility=snippet.visibility.value,
        tags=snippet.tags,
        created_by=snippet.created_by,
        favorite=snippet.favorite
    )
    
    return db_snippet_to_pydantic(db_snippet)

@router.put("/snippets/{snippet_id}", response_model=Snippet)
async def update_snippet(snippet_id: str, update: SnippetUpdate, db: Session = Depends(get_db)):
    """Update a snippet and create a version if code changed"""
    update_data = {}
    
    if update.title:
        update_data['title'] = update.title
    if update.description is not None:
        update_data['description'] = update.description
    if update.code:
        update_data['code'] = update.code
    if update.language:
        update_data['language'] = update.language.value
    if update.visibility:
        update_data['visibility'] = update.visibility.value
    if update.tags is not None:
        update_data['tags'] = update.tags
    if update.favorite is not None:
        update_data['favorite'] = update.favorite
    
    db_snippet = services.update_snippet(db, snippet_id, **update_data)
    if not db_snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    
    return db_snippet_to_pydantic(db_snippet)

@router.delete("/snippets/{snippet_id}")
async def delete_snippet(snippet_id: str, db: Session = Depends(get_db)):
    """Delete a snippet"""
    success = services.delete_snippet(db, snippet_id)
    if not success:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return {"message": "Snippet deleted"}

@router.post("/snippets/{snippet_id}/use")
async def increment_use_count(snippet_id: str, db: Session = Depends(get_db)):
    """Increment use count when snippet is copied/used"""
    use_count = services.increment_snippet_use_count(db, snippet_id)
    if use_count is None:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return {"use_count": use_count}

@router.post("/snippets/{snippet_id}/favorite")
async def toggle_favorite(snippet_id: str, db: Session = Depends(get_db)):
    """Toggle favorite status of a snippet"""
    favorite = services.toggle_snippet_favorite(db, snippet_id)
    if favorite is None:
        raise HTTPException(status_code=404, detail="Snippet not found")
    return {"favorite": favorite}

@router.get("/snippets/{snippet_id}/versions")
async def get_snippet_versions(snippet_id: str, db: Session = Depends(get_db)):
    """Get version history for a snippet"""
    db_snippet = services.get_snippet_by_id(db, snippet_id)
    if not db_snippet:
        raise HTTPException(status_code=404, detail="Snippet not found")
    
    db_versions = services.get_snippet_versions(db, snippet_id)
    return [
        SnippetVersion(
            version=v.version,
            code=v.code,
            description=v.description,
            created_at=v.created_at.isoformat() if v.created_at else "",
            created_by=v.created_by
        )
        for v in db_versions
    ]

@router.post("/snippets/{snippet_id}/versions/{version_number}/restore")
async def restore_version(snippet_id: str, version_number: int, db: Session = Depends(get_db)):
    """Restore a previous version of a snippet"""
    db_snippet = services.restore_snippet_version(db, snippet_id, version_number)
    if not db_snippet:
        raise HTTPException(status_code=404, detail="Snippet or version not found")
    return db_snippet_to_pydantic(db_snippet)

# Tag Endpoints
@router.get("/tags")
async def get_tags(db: Session = Depends(get_db)):
    """Get all tags with usage counts"""
    db_tags = services.get_all_tags(db)
    return [Tag(name=t.name, count=t.count, color=t.color) for t in db_tags]

@router.get("/tags/{tag_name}/snippets")
async def get_snippets_by_tag(tag_name: str, db: Session = Depends(get_db)):
    """Get all snippets with a specific tag"""
    db_snippets = services.get_snippets_by_tag(db, tag_name)
    return [db_snippet_to_pydantic(s) for s in db_snippets]

# Language Endpoints
@router.get("/languages")
async def get_supported_languages():
    """Get list of all supported languages"""
    return [
        {"value": lang.value, "label": lang.value.title()}
        for lang in SnippetLanguage
    ]

@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get snippet statistics"""
    all_snippets = services.get_snippets(db, limit=10000)
    
    language_counts = {}
    for snippet in all_snippets:
        lang = snippet.language
        language_counts[lang] = language_counts.get(lang, 0) + 1
    
    most_used_language = max(language_counts.items(), key=lambda x: x[1])[0] if language_counts else None
    
    total_versions = sum(len(services.get_snippet_versions(db, s.id)) for s in all_snippets)
    
    return {
        "total_snippets": len(all_snippets),
        "total_tags": len(services.get_all_tags(db)),
        "personal_snippets": len([s for s in all_snippets if s.visibility == "personal"]),
        "team_snippets": len([s for s in all_snippets if s.visibility == "team"]),
        "favorite_snippets": len([s for s in all_snippets if s.favorite]),
        "most_used_language": most_used_language,
        "total_versions": total_versions
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
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint"""
    snippets_count = len(services.get_snippets(db, limit=10000))
    tags_count = len(services.get_all_tags(db))
    
    return {
        "status": "healthy",
        "snippets_count": snippets_count,
        "tags_count": tags_count
    }
