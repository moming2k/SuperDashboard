# AI Code Review Assistant Plugin

GPT-4 powered automated code review system for SuperDashboard with security scanning, quality checks, best practice suggestions, and PR description generation.

## Features

### 1. **Comprehensive Code Review**
- Full code analysis covering security, quality, performance, and best practices
- Line-specific issue detection with actionable suggestions
- Quality scoring (0-100) for code assessment
- Multi-language support with automatic detection

### 2. **Security Vulnerability Detection**
- SQL injection detection
- XSS (Cross-Site Scripting) vulnerabilities
- CSRF vulnerabilities
- Hardcoded secrets and credentials
- Path traversal vulnerabilities
- Command injection risks
- Insecure cryptography
- Sensitive data exposure

### 3. **Code Quality Analysis**
- Code complexity assessment
- Error handling verification
- Code duplication detection
- Naming convention checks
- Function/method length analysis
- Dead code identification

### 4. **Best Practice Suggestions**
- Language-specific best practices
- Design pattern recommendations
- SOLID principles compliance
- DRY (Don't Repeat Yourself) violations
- Code readability improvements
- Documentation suggestions

### 5. **PR Description Auto-Generation**
- Analyzes git diffs to create professional PR descriptions
- Generates concise titles and detailed descriptions
- Lists specific changes as bullet points
- One-click copy to clipboard

### 6. **Pre-commit Checks**
- Automated review of all staged files before commit
- Configurable severity thresholds
- Multi-file batch processing
- Git hook integration

## Installation

The plugin is automatically loaded by SuperDashboard. Ensure you have:

1. **OpenAI API Key** configured in `backend/.env`:
   ```bash
   OPENAI_API_KEY=sk-your-api-key-here
   ```

2. **Symlink created** (should be automatic):
   ```bash
   cd frontend/src/plugins
   ln -s ../../../plugins/code-review/frontend code-review
   ```

3. **Backend and Frontend running**:
   ```bash
   # Terminal 1: Backend
   cd backend && python main.py

   # Terminal 2: Frontend
   cd frontend && npm run dev
   ```

## Usage

### Web Interface

Access the Code Review tab in SuperDashboard to use the following features:

#### Code Review Tab
1. Paste your code or enter a filename
2. Choose review type:
   - **Full Review**: Comprehensive analysis
   - **Security Scan**: Security-focused
   - **Quality Check**: Code quality focused
   - **Best Practices**: Best practices focused
3. View results with severity levels, categories, and suggestions

#### Security Scan Tab
1. Paste code to scan
2. Click "Run Security Scan"
3. View critical, high, and medium severity issues
4. Get specific remediation steps

#### PR Description Tab
1. Paste git diff output
2. Optionally add branch name
3. Click "Generate PR Description"
4. Copy the generated description

#### Pre-commit Check Tab
1. Add multiple files with their content
2. Click "Run Pre-commit Check"
3. View pass/fail status and issues by file
4. See quality scores per file

### API Endpoints

#### `POST /plugins/code-review/review`
Comprehensive code review.

**Request:**
```json
{
  "code": "function example() { ... }",
  "language": "javascript",
  "filename": "example.js"
}
```

**Response:**
```json
{
  "issues": [
    {
      "severity": "high",
      "category": "security",
      "line": 10,
      "message": "Potential SQL injection vulnerability",
      "suggestion": "Use parameterized queries"
    }
  ],
  "summary": "Found 3 issues requiring attention",
  "score": 75
}
```

#### `POST /plugins/code-review/review/security`
Security-focused code review (same format as `/review`).

#### `POST /plugins/code-review/review/quality`
Quality-focused code review (same format as `/review`).

#### `POST /plugins/code-review/review/best-practices`
Best practices focused review (same format as `/review`).

#### `POST /plugins/code-review/precommit-check`
Multi-file pre-commit check.

**Request:**
```json
{
  "files": [
    {
      "filename": "src/auth.py",
      "content": "def login(username, password): ..."
    },
    {
      "filename": "src/api.js",
      "content": "export function getUser() { ... }"
    }
  ]
}
```

**Response:**
```json
{
  "passed": false,
  "total_issues": 5,
  "critical_issues": 2,
  "file_reviews": {
    "src/auth.py": {
      "issues": [...],
      "summary": "...",
      "score": 65
    },
    "src/api.js": {
      "issues": [...],
      "summary": "...",
      "score": 80
    }
  },
  "summary": "✗ Found 2 critical issues that must be fixed."
}
```

#### `POST /plugins/code-review/generate-pr-description`
Generate PR description from git diff.

**Request:**
```json
{
  "diff": "diff --git a/file.py ...",
  "branch_name": "feature/new-auth",
  "commit_messages": ["Add user authentication", "Fix login bug"]
}
```

**Response:**
```json
{
  "title": "Add user authentication system",
  "description": "Implements JWT-based authentication...",
  "changes": [
    "Added login endpoint with JWT token generation",
    "Implemented password hashing with bcrypt",
    "Created user session management"
  ]
}
```

### Git Pre-commit Hook

Install the pre-commit hook to automatically review code before commits:

#### Installation

```bash
# From the plugin directory
cp pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

#### Configuration

Set environment variables to customize behavior:

```bash
# Skip code review
SKIP_CODE_REVIEW=1 git commit -m "Quick fix"

# Set severity threshold (critical, high, medium, low)
CODE_REVIEW_SEVERITY=critical git commit -m "Only block on critical"

# Use different API endpoint
CODE_REVIEW_API=http://production:8000 git commit -m "Use prod API"
```

#### Default Behavior

- Blocks commit if critical or high severity issues are found
- Shows all issues found with suggestions
- Allows bypass with `SKIP_CODE_REVIEW=1`
- Skips automatically if backend is not running

## Supported Languages

The plugin automatically detects language from file extensions:

- Python (`.py`)
- JavaScript (`.js`, `.jsx`)
- TypeScript (`.ts`, `.tsx`)
- Java (`.java`)
- C/C++ (`.c`, `.cpp`)
- C# (`.cs`)
- Go (`.go`)
- Rust (`.rs`)
- Ruby (`.rb`)
- PHP (`.php`)
- Swift (`.swift`)
- Kotlin (`.kt`)
- Scala (`.scala`)
- SQL (`.sql`)
- Bash (`.sh`)
- YAML (`.yml`, `.yaml`)
- JSON (`.json`)
- HTML (`.html`)
- CSS (`.css`, `.scss`)

## Issue Severity Levels

- **Critical**: Security vulnerabilities or major bugs that must be fixed
- **High**: Serious issues that should be addressed soon
- **Medium**: Moderate issues that affect code quality
- **Low**: Minor improvements or style suggestions
- **Info**: Informational suggestions for best practices

## Issue Categories

- **Security**: Security vulnerabilities and risks
- **Quality**: Code quality and maintainability
- **Performance**: Performance optimization opportunities
- **Best-practice**: Adherence to best practices
- **Style**: Code style and formatting

## Examples

### Example 1: Review a Python file

```python
# review-example.py
def login(username, password):
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    result = db.execute(query)
    return result
```

**Issues Found:**
- **Critical** - Security: SQL injection vulnerability on line 2
- **High** - Security: Passwords should be hashed, not stored in plaintext
- **Medium** - Best-practice: No error handling for database operations

### Example 2: Generate PR Description

```bash
# Get git diff
git diff main...feature/auth > diff.txt

# Use the web interface to paste the diff and generate description
```

**Generated:**
```
Title: Add JWT-based authentication system

Description: Implements a complete authentication system using JWT tokens
for secure user sessions. Includes login, logout, and token refresh endpoints
with bcrypt password hashing.

Changes:
- Added JWT token generation and validation middleware
- Implemented bcrypt password hashing for user credentials
- Created login, logout, and refresh token endpoints
- Added authentication error handling and validation
```

## Configuration

### Environment Variables

Set in `backend/.env`:

```bash
# Required
OPENAI_API_KEY=sk-your-api-key

# Optional - these are handled by the hook
CODE_REVIEW_SEVERITY=high
CODE_REVIEW_API=http://localhost:8000
```

### Customizing Review Focus

You can customize what aspects the AI focuses on by using different endpoints:

```bash
# Focus only on security
curl -X POST http://localhost:8000/plugins/code-review/review/security \
  -H "Content-Type: application/json" \
  -d '{"code": "...", "language": "python"}'

# Focus only on code quality
curl -X POST http://localhost:8000/plugins/code-review/review/quality \
  -H "Content-Type: application/json" \
  -d '{"code": "...", "language": "python"}'
```

## Performance

- **Average review time**: 3-10 seconds per file (depending on code size)
- **Token usage**: ~500-2000 tokens per review (GPT-4)
- **Rate limits**: Subject to OpenAI API rate limits
- **Batch processing**: Pre-commit checks process files in parallel

## Troubleshooting

### "OpenAI API key not configured"
- Ensure `OPENAI_API_KEY` is set in `backend/.env`
- Restart the backend server

### "Plugin not loading"
- Check that `plugin.json` exists
- Verify the symlink: `ls -la frontend/src/plugins/code-review`
- Restart both backend and frontend

### "Pre-commit hook not working"
- Ensure hook is executable: `chmod +x .git/hooks/pre-commit`
- Check that backend is running: `curl http://localhost:8000/plugins/code-review/health`
- Use `SKIP_CODE_REVIEW=1` to bypass if needed

### "Reviews are slow"
- GPT-4 can take 5-10 seconds for large files
- Consider reviewing smaller code chunks
- Use specific review endpoints (security/quality) for faster, focused reviews

## Limitations

- Requires OpenAI API key (costs apply based on usage)
- Reviews are as good as GPT-4's training data
- Cannot execute code or run tests
- May have false positives/negatives
- Limited to text files only
- Maximum file size ~8000 tokens (GPT-4 context limit)

## Future Enhancements

Potential improvements for future versions:

- [ ] Support for GPT-4o and other models
- [ ] Caching of review results
- [ ] Custom rule configuration
- [ ] Integration with GitHub Actions
- [ ] Review history and tracking
- [ ] Team-specific coding standards
- [ ] Automated fix suggestions with diffs
- [ ] Integration with IDE extensions

## Architecture

```
plugins/code-review/
├── backend/
│   └── main.py              # FastAPI router with GPT-4 integration
├── frontend/
│   └── CodeReview.jsx       # React UI component
├── plugin.json              # Plugin manifest
├── pre-commit-hook.sh       # Git pre-commit hook script
└── README.md                # This file
```

## API Architecture

The backend uses:
- **FastAPI** for async API endpoints
- **OpenAI Python SDK** for GPT-4 integration
- **Pydantic** for request/response validation
- **JSON mode** for structured AI responses

The frontend uses:
- **React 19** with functional components
- **Tailwind CSS** for styling
- **Fetch API** for backend communication
- **Multiple views** with tab navigation

## Contributing

To contribute to this plugin:

1. Follow SuperDashboard plugin conventions
2. Test all endpoints before committing
3. Update documentation for new features
4. Ensure OpenAI API calls are efficient
5. Add error handling for edge cases

## License

This plugin is part of SuperDashboard and follows the same MIT license.

Copyright 2025 Chris Chan

---

**Version**: 1.0.0
**Author**: SuperDashboard AI Code Review Plugin
**Last Updated**: 2025-01-01
