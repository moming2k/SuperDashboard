import os
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

router = APIRouter()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class CodeReviewRequest(BaseModel):
    code: str
    language: Optional[str] = None
    filename: Optional[str] = None
    context: Optional[str] = None

class ReviewIssue(BaseModel):
    severity: str  # "critical", "high", "medium", "low", "info"
    category: str  # "security", "quality", "performance", "best-practice", "style"
    line: Optional[int] = None
    message: str
    suggestion: Optional[str] = None

class CodeReviewResponse(BaseModel):
    issues: List[ReviewIssue]
    summary: str
    score: int  # 0-100

class PRDescriptionRequest(BaseModel):
    diff: str
    branch_name: Optional[str] = None
    commit_messages: Optional[List[str]] = None

class PRDescriptionResponse(BaseModel):
    title: str
    description: str
    changes: List[str]

class PreCommitCheckRequest(BaseModel):
    files: List[Dict[str, str]]  # List of {filename: str, content: str}

class PreCommitCheckResponse(BaseModel):
    passed: bool
    total_issues: int
    critical_issues: int
    file_reviews: Dict[str, CodeReviewResponse]
    summary: str

def get_language_from_filename(filename: str) -> str:
    """Detect language from filename extension"""
    if not filename:
        return "unknown"

    ext_map = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".java": "java",
        ".cpp": "c++",
        ".c": "c",
        ".cs": "c#",
        ".go": "go",
        ".rs": "rust",
        ".rb": "ruby",
        ".php": "php",
        ".swift": "swift",
        ".kt": "kotlin",
        ".scala": "scala",
        ".sql": "sql",
        ".sh": "bash",
        ".yml": "yaml",
        ".yaml": "yaml",
        ".json": "json",
        ".html": "html",
        ".css": "css",
        ".scss": "scss",
    }

    ext = os.path.splitext(filename)[1].lower()
    return ext_map.get(ext, "unknown")

async def review_code_with_gpt(code: str, language: str, focus: str = "general") -> Dict[str, Any]:
    """Use GPT-4 to review code with specific focus"""
    if not client.api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    focus_prompts = {
        "security": """Analyze this code for security vulnerabilities. Focus on:
- SQL injection, XSS, CSRF vulnerabilities
- Insecure authentication/authorization
- Hardcoded secrets or credentials
- Path traversal vulnerabilities
- Command injection risks
- Insecure cryptography
- Sensitive data exposure""",

        "quality": """Analyze this code for quality issues. Focus on:
- Code complexity and maintainability
- Error handling
- Code duplication
- Naming conventions
- Function/method length
- Code organization
- Dead code""",

        "best-practices": """Analyze this code for best practice violations. Focus on:
- Language-specific best practices
- Design patterns usage
- SOLID principles
- DRY (Don't Repeat Yourself)
- Code readability
- Documentation
- Testing considerations""",

        "general": """Perform a comprehensive code review. Analyze:
- Security vulnerabilities (SQL injection, XSS, hardcoded secrets, etc.)
- Code quality (complexity, error handling, duplication)
- Best practices (design patterns, SOLID, DRY)
- Performance issues
- Style and conventions"""
    }

    prompt = f"""{focus_prompts.get(focus, focus_prompts['general'])}

Language: {language}

Code:
```{language}
{code}
```

Return your analysis as a JSON object with this structure:
{{
  "issues": [
    {{
      "severity": "critical|high|medium|low|info",
      "category": "security|quality|performance|best-practice|style",
      "line": <line_number or null>,
      "message": "<description of the issue>",
      "suggestion": "<how to fix it>"
    }}
  ],
  "summary": "<overall assessment>",
  "score": <0-100 quality score>
}}

Be specific and actionable. Include line numbers when possible."""

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert code reviewer with deep knowledge of security, best practices, and code quality across multiple programming languages. Always return valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            response_format={"type": "json_object"}
        )

        import json
        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        raise HTTPException(status_code=500, detail=f"AI review failed: {str(e)}")

@router.post("/review", response_model=CodeReviewResponse)
async def review_code(request: CodeReviewRequest):
    """Comprehensive code review"""
    language = request.language or get_language_from_filename(request.filename or "")

    result = await review_code_with_gpt(request.code, language, focus="general")

    return CodeReviewResponse(
        issues=[ReviewIssue(**issue) for issue in result.get("issues", [])],
        summary=result.get("summary", ""),
        score=result.get("score", 50)
    )

@router.post("/review/security", response_model=CodeReviewResponse)
async def review_security(request: CodeReviewRequest):
    """Security-focused code review"""
    language = request.language or get_language_from_filename(request.filename or "")

    result = await review_code_with_gpt(request.code, language, focus="security")

    return CodeReviewResponse(
        issues=[ReviewIssue(**issue) for issue in result.get("issues", [])],
        summary=result.get("summary", ""),
        score=result.get("score", 50)
    )

@router.post("/review/quality", response_model=CodeReviewResponse)
async def review_quality(request: CodeReviewRequest):
    """Quality-focused code review"""
    language = request.language or get_language_from_filename(request.filename or "")

    result = await review_code_with_gpt(request.code, language, focus="quality")

    return CodeReviewResponse(
        issues=[ReviewIssue(**issue) for issue in result.get("issues", [])],
        summary=result.get("summary", ""),
        score=result.get("score", 50)
    )

@router.post("/review/best-practices", response_model=CodeReviewResponse)
async def review_best_practices(request: CodeReviewRequest):
    """Best practices focused code review"""
    language = request.language or get_language_from_filename(request.filename or "")

    result = await review_code_with_gpt(request.code, language, focus="best-practices")

    return CodeReviewResponse(
        issues=[ReviewIssue(**issue) for issue in result.get("issues", [])],
        summary=result.get("summary", ""),
        score=result.get("score", 50)
    )

@router.post("/precommit-check", response_model=PreCommitCheckResponse)
async def precommit_check(request: PreCommitCheckRequest):
    """Run pre-commit checks on multiple files"""
    if not request.files:
        raise HTTPException(status_code=400, detail="No files provided")

    file_reviews = {}
    total_issues = 0
    critical_issues = 0

    for file_info in request.files:
        filename = file_info.get("filename", "")
        content = file_info.get("content", "")

        if not content:
            continue

        language = get_language_from_filename(filename)
        result = await review_code_with_gpt(content, language, focus="general")

        review = CodeReviewResponse(
            issues=[ReviewIssue(**issue) for issue in result.get("issues", [])],
            summary=result.get("summary", ""),
            score=result.get("score", 50)
        )

        file_reviews[filename] = review
        total_issues += len(review.issues)
        critical_issues += sum(1 for issue in review.issues if issue.severity in ["critical", "high"])

    passed = critical_issues == 0

    summary = f"Checked {len(file_reviews)} files. "
    if passed:
        summary += f"✓ No critical issues found. {total_issues} total suggestions."
    else:
        summary += f"✗ Found {critical_issues} critical issues that must be fixed."

    return PreCommitCheckResponse(
        passed=passed,
        total_issues=total_issues,
        critical_issues=critical_issues,
        file_reviews=file_reviews,
        summary=summary
    )

@router.post("/generate-pr-description", response_model=PRDescriptionResponse)
async def generate_pr_description(request: PRDescriptionRequest):
    """Generate PR title and description from git diff"""
    if not client.api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    context = f"Branch: {request.branch_name}\n\n" if request.branch_name else ""
    if request.commit_messages:
        context += "Commit messages:\n" + "\n".join(f"- {msg}" for msg in request.commit_messages) + "\n\n"

    prompt = f"""{context}Analyze this git diff and generate a pull request description:

```diff
{request.diff}
```

Return a JSON object with:
{{
  "title": "<concise PR title>",
  "description": "<detailed description of changes>",
  "changes": ["<bullet point 1>", "<bullet point 2>", ...]
}}

The title should be clear and concise. The description should explain what changed and why. Changes should be specific bullet points."""

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert at writing clear, professional pull request descriptions. Always return valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            response_format={"type": "json_object"}
        )

        import json
        result = json.loads(response.choices[0].message.content)

        return PRDescriptionResponse(
            title=result.get("title", ""),
            description=result.get("description", ""),
            changes=result.get("changes", [])
        )

    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        raise HTTPException(status_code=500, detail=f"PR description generation failed: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    api_key_configured = bool(client.api_key)
    return {
        "status": "healthy",
        "openai_configured": api_key_configured
    }

# Command Palette Integration
@router.get("/commands")
async def get_commands():
    """Return commands that this plugin provides to the Command Palette"""
    return {
        "commands": [
            {
                "id": "review-code",
                "label": "Code Review: General Review",
                "description": "AI-powered comprehensive code review",
                "category": "Code Review",
                "icon": "🔍",
                "endpoint": "/review",
                "method": "POST",
                "requiresInput": True,
                "inputSchema": {
                    "type": "form",
                    "fields": [
                        {
                            "name": "code",
                            "label": "Code to Review",
                            "type": "textarea",
                            "required": True,
                            "placeholder": "Paste your code here..."
                        },
                        {
                            "name": "language",
                            "label": "Language",
                            "type": "select",
                            "required": False,
                            "options": ["python", "javascript", "typescript", "java", "go", "rust", "c++", "auto-detect"]
                        }
                    ]
                }
            },
            {
                "id": "review-security",
                "label": "Code Review: Security Scan",
                "description": "Focused security vulnerability analysis",
                "category": "Code Review",
                "icon": "🔒",
                "endpoint": "/review/security",
                "method": "POST",
                "requiresInput": True,
                "inputSchema": {
                    "type": "form",
                    "fields": [
                        {
                            "name": "code",
                            "label": "Code to Review",
                            "type": "textarea",
                            "required": True,
                            "placeholder": "Paste your code here..."
                        }
                    ]
                }
            },
            {
                "id": "review-quality",
                "label": "Code Review: Quality Check",
                "description": "Code quality and maintainability analysis",
                "category": "Code Review",
                "icon": "⭐",
                "endpoint": "/review/quality",
                "method": "POST",
                "requiresInput": True,
                "inputSchema": {
                    "type": "form",
                    "fields": [
                        {
                            "name": "code",
                            "label": "Code to Review",
                            "type": "textarea",
                            "required": True,
                            "placeholder": "Paste your code here..."
                        }
                    ]
                }
            }
        ]
    }
