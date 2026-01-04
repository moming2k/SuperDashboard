# SuperDashboard Setup Guide

Complete setup instructions for local development, Docker, and DevContainer environments.

---

## 📋 Prerequisites

### Required
- **Python 3.11+** - [Download](https://www.python.org/downloads/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **pnpm 8+** - Fast, disk space efficient package manager
  ```bash
  npm install -g pnpm
  # or
  curl -fsSL https://get.pnpm.io/install.sh | sh -
  ```
- **PostgreSQL 16** - [Download](https://www.postgresql.org/download/) or use Docker

### Recommended
- **uv** - Fast Python package manager (10-100x faster than pip!)
  ```bash
  curl -LsSf https://astral.sh/uv/install.sh | sh
  ```

### Optional
- **Docker** - For containerized deployment
- **VS Code** with Dev Containers extension - For DevContainer support

---

## 🚀 Quick Start (Automated Setup)

The fastest way to get started:

```bash
# Run the automated setup script
./scripts/setup-dev.sh
```

This script will:
- ✅ Check Python and Node.js versions
- ✅ Create isolated `.venv` virtual environment
- ✅ Install all Python dependencies from `pyproject.toml`
- ✅ Install all Node.js dependencies
- ✅ Create `.env` files from templates
- ✅ Display next steps

---

## 🛠️ Manual Setup

If you prefer manual setup or need more control:

### 1. Backend Setup

```bash
cd backend

# Option A: Using uv (RECOMMENDED - 10-100x faster!)
uv venv .venv                    # Create virtual environment
source .venv/bin/activate        # Activate (Linux/Mac)
# .venv\Scripts\activate.bat     # Activate (Windows)
uv pip install -e .              # Install from pyproject.toml

# Option B: Using pip (slower but works everywhere)
python3 -m venv .venv            # Create virtual environment
source .venv/bin/activate        # Activate
pip install -e .                 # Install from pyproject.toml

# Configure environment
cp .env.example .env
nano .env  # Edit and add your API keys
```

### 2. Frontend Setup

```bash
cd frontend

pnpm install                     # Install dependencies
cp .env.example .env            # Create environment file
```

### 3. Database Setup

#### Option A: Local PostgreSQL

```bash
# Create database
createdb superdashboard

# Or using psql
psql -U postgres
CREATE DATABASE superdashboard;
\q
```

#### Option B: Docker PostgreSQL

```bash
docker-compose up -d db
```

### 4. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
source .venv/bin/activate        # Activate virtual environment
python main.py                   # Start backend server
```

**Terminal 2 - Frontend:**
```bash
cd frontend
pnpm dev                         # Start frontend dev server
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

---

## 🐳 Docker Setup

### Using Docker Compose (Recommended)

```bash
# Start entire stack (backend + frontend + PostgreSQL)
docker-compose up --build

# Start in background
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Stop and remove volumes (⚠️ deletes database data)
docker-compose down -v
```

### Using Dockerfile Directly

```bash
# Build image
docker build -t superdashboard:latest .

# Run container
docker run -p 8000:8000 --env-file backend/.env superdashboard:latest
```

---

## 📦 DevContainer Setup

### Using VS Code Dev Containers

1. **Open in VS Code**
   ```bash
   code .
   ```

2. **Reopen in Container**
   - Press `F1` or `Cmd/Ctrl+Shift+P`
   - Select "Dev Containers: Reopen in Container"
   - Wait for container to build (first time only)

3. **Everything is Ready!**
   - PostgreSQL automatically running
   - Backend `.venv` automatically created
   - All dependencies automatically installed with uv
   - Servers auto-start via `start-servers.sh`

**Ports:**
- Backend: http://localhost:18010
- Frontend: http://localhost:15173
- PostgreSQL: localhost:15432

---

## 📝 Environment Configuration

### Backend `.env` (Required)

```bash
# Database (REQUIRED)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/superdashboard

# AI Features (Optional)
OPENAI_API_KEY=sk-...

# CORS (Optional)
CORS_ORIGINS=*  # Use "*" for dev, specific origins for production

# Jira Plugin (Optional)
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_JQL=project = "MYPROJECT" order by created DESC

# WhatsApp Plugin (Optional)
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### Frontend `.env` (Optional)

```bash
# Backend API URL (optional, auto-detects if not set)
VITE_API_BASE_URL=http://localhost:8000

# DevContainer detection (auto-set in devcontainer)
VITE_DEVCONTAINER=true
```

---

## 🧪 Development Workflow

### Activating Virtual Environment

**Always activate the virtual environment before running Python commands:**

```bash
cd backend
source .venv/bin/activate        # Linux/Mac
# .venv\Scripts\activate.bat     # Windows
```

**Verify activation:**
```bash
which python                     # Should show backend/.venv/bin/python
python --version                 # Should show Python 3.11+
```

**Deactivate when done:**
```bash
deactivate
```

### Installing New Dependencies

**Python (Backend):**

```bash
# Activate virtual environment first
source .venv/bin/activate

# Edit backend/pyproject.toml and add your dependency
# Then reinstall:
uv pip install -e .              # With uv (fast)
# or
pip install -e .                 # With pip (slower)
```

**Node.js (Frontend):**

```bash
cd frontend

# Add a dependency
pnpm add package-name

# Add a dev dependency
pnpm add -D package-name

# Remove a dependency
pnpm remove package-name
```

### Running Tests

```bash
cd backend
source .venv/bin/activate
pytest                           # Run all tests
pytest -v                        # Verbose output
pytest --cov                     # With coverage
```

### Code Formatting

```bash
cd backend
source .venv/bin/activate
black .                          # Format code
ruff check .                     # Lint code
mypy .                           # Type check
```

---

## 🔧 Troubleshooting

### Virtual Environment Issues

**Problem:** `python` still points to system Python
```bash
# Solution: Deactivate and reactivate
deactivate
source .venv/bin/activate
```

**Problem:** Dependencies not found after installation
```bash
# Solution: Ensure virtual environment is activated
which python                     # Should show .venv/bin/python
pip list                         # Should show installed packages
```

### Database Connection Issues

**Problem:** `Connection refused` or `database does not exist`
```bash
# Check PostgreSQL is running
pg_isready

# Create database if needed
createdb superdashboard

# Check DATABASE_URL in .env
cat backend/.env | grep DATABASE_URL
```

### Port Already in Use

**Problem:** `Address already in use` error
```bash
# Find process using port 8000
lsof -i :8000                    # Linux/Mac
netstat -ano | findstr :8000     # Windows

# Kill the process or use different port
export PORT=8001                 # Use different port
```

### pnpm Not Found

**Problem:** `command not found: pnpm`
```bash
# Install pnpm globally
npm install -g pnpm

# Or use standalone script
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Verify installation
pnpm --version
```

### uv Not Found

**Problem:** `command not found: uv`
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Add to PATH
export PATH="$HOME/.cargo/bin:$PATH"
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

---

## 📚 Additional Resources

- **Project Documentation**: [CLAUDE.md](./CLAUDE.md)
- **Backend API Docs**: http://localhost:8000/docs (when running)
- **Health Check**: http://localhost:8000/health
- **uv Documentation**: https://github.com/astral-sh/uv
- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **React Documentation**: https://react.dev/

---

## 💡 Tips & Best Practices

### Virtual Environment
- ✅ **Always activate** `.venv` before running Python commands
- ✅ **Never commit** `.venv` to git (already in `.gitignore`)
- ✅ **Use `uv`** for 10-100x faster package installation
- ✅ **Use `pyproject.toml`** for dependency management (modern standard)

### Package Management
- ✅ **Use `pnpm`** instead of npm for faster, more efficient installs
- ✅ **Commit `pnpm-lock.yaml`** to ensure consistent dependencies
- ✅ **Never commit** `node_modules` or `.pnpm-store` to git

### Development
- ✅ **Use docker-compose** for full stack development
- ✅ **Use DevContainer** for consistent cloud development
- ✅ **Check health endpoint** to verify backend is running
- ✅ **Read logs** when something goes wrong

### Production
- ✅ **Never use `*` for CORS_ORIGINS** in production
- ✅ **Always use environment variables** for secrets
- ✅ **Use Docker** for deployment
- ✅ **Enable health checks** for monitoring

---

## 🆘 Getting Help

If you encounter issues:

1. **Check this guide** for common solutions
2. **Review logs** for error messages
3. **Check environment variables** are configured correctly
4. **Verify database** is running and accessible
5. **Check virtual environment** is activated
6. **Open an issue** on GitHub with logs and error messages

---

**Happy coding! 🚀**
