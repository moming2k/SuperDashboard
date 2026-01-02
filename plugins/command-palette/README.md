# Command Palette Plugin

A keyboard-driven command interface for SuperDashboard, similar to VS Code's Command Palette (Cmd/Ctrl+Shift+P).

## Features

- **Quick Access**: Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux) to open
- **Fuzzy Search**: Filter commands by typing
- **Keyboard Navigation**: Use arrow keys to navigate, Enter to execute
- **Multiple Categories**: Git, Build, Test, Lint, Jira, and Documentation commands

## Available Commands

### Git Operations
- **Git: Show Status** - Display current working tree status
- **Git: Show Recent Commits** - View last 10 commits
- **Git: List Branches** - Show all local and remote branches
- **Git: Pull** - Fetch and integrate changes from remote
- **Git: Push** - Push commits to remote repository
- **Git: Commit All Changes** - Stage and commit all changes (prompts for message)
- **Git: Checkout Branch** - Switch to a different branch (prompts for branch name)

### Build & Install
- **Build: Frontend** - Run `npm run build` in frontend directory
- **Install: Frontend Dependencies** - Run `npm install` for frontend
- **Install: Backend Dependencies** - Install Python packages from requirements.txt

### Testing & Linting
- **Test: Frontend** - Run frontend tests
- **Test: Backend** - Run backend tests with pytest
- **Lint: Frontend** - Run ESLint on frontend code

### Jira Integration
- **Jira: Create Ticket** - Create a new Jira issue (requires Jira credentials in .env)

### Documentation
- **Docs: Search Documentation** - Search through project documentation files

## Usage

1. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux) to open the command palette
2. Start typing to filter commands
3. Use arrow keys (↑↓) to navigate through the list
4. Press `Enter` to execute the selected command
5. Press `Escape` to close the palette

## Commands with Input

Some commands require additional input:
- **Git: Commit All Changes** - Will prompt for a commit message
- **Git: Checkout Branch** - Will prompt for the branch name
- **Jira: Create Ticket** - Will show a form for project, summary, description, and issue type
- **Docs: Search Documentation** - Will prompt for a search query

## Configuration

This plugin does not require any configuration. However, to use Jira commands, you need to set the following environment variables in `backend/.env`:

```bash
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
```

## Technical Details

### Backend API Endpoints

All endpoints are prefixed with `/plugins/command-palette`:

- `GET /commands` - Get list of all available commands
- `GET /git/status` - Get git status
- `GET /git/log` - Get recent commits
- `GET /git/branches` - List branches
- `POST /git/pull` - Pull from remote
- `POST /git/push` - Push to remote
- `POST /git/commit?message=<msg>` - Commit changes
- `POST /git/checkout?branch=<name>` - Checkout branch
- `POST /build/frontend` - Build frontend
- `POST /build/install-frontend` - Install frontend deps
- `POST /build/install-backend` - Install backend deps
- `POST /test/frontend` - Run frontend tests
- `POST /test/backend` - Run backend tests
- `POST /lint/frontend` - Lint frontend
- `POST /jira/create-ticket` - Create Jira ticket
- `GET /docs/search?query=<term>` - Search documentation

### File Structure

```
plugins/command-palette/
├── backend/
│   └── main.py              # FastAPI router with command execution
├── frontend/
│   └── CommandPalette.jsx   # React component with keyboard shortcuts
├── plugin.json              # Plugin manifest
└── README.md                # This file
```

## Keyboard Shortcuts

- `Cmd+Shift+P` / `Ctrl+Shift+P` - Open command palette
- `Escape` - Close command palette
- `↑` / `↓` - Navigate through commands
- `Enter` - Execute selected command

## Future Enhancements

Potential improvements for future versions:
- Custom command registration via plugin API
- Command history and favorites
- Keyboard shortcut customization
- Command aliases
- Recent commands list
- Command suggestions based on context
