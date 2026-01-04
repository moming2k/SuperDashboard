# SuperDashboard

A modern, extensible dashboard platform with AI-powered plugins for task management, monitoring, notifications, and more.

## Features

- 🎨 **Modern UI** - Beautiful, responsive interface with dark mode
- 🔌 **Plugin System** - Extensible architecture with hot-reloadable plugins
- 🤖 **AI Integration** - GPT-4 powered AI assistant and WhatsApp bot
- 📊 **Monitoring** - DNS & API endpoint monitoring with change detection
- 📋 **Task Management** - Built-in task tracking and Jira integration
- 📰 **RSS Reader** - AI-powered RSS feed aggregation with Q&A
- 🔔 **Notifications** - Unified notification center with custom rules
- 💬 **WhatsApp AI** - Twilio-powered WhatsApp integration
- 📝 **Snippet Manager** - Code snippet storage and sharing
- 🗄️ **PostgreSQL** - Persistent data storage for all plugins

## Quick Start

Choose your preferred development environment:

### Option 1: Local Development (Recommended for Mac/Linux)

**Prerequisites:**
- Python 3.11+
- Node.js 18+
- pnpm 8+
- PostgreSQL 14+

**Setup:**

1. **Clone the repository**
   ```bash
   git clone https://github.com/moming2k/SuperDashboard.git
   cd SuperDashboard
   ```

2. **Start PostgreSQL**
   ```bash
   # Using Docker (recommended)
   docker run -d \
     --name superdashboard-db \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=superdashboard \
     -p 5432:5432 \
     postgres:14-alpine
   
   # Or use your local PostgreSQL installation
   ```

3. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   
   # Copy and configure environment variables
   cp .env.example .env
   # Edit .env with your settings
   
   # Start backend
   uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```

4. **Frontend Setup** (in a new terminal)
   ```bash
   cd frontend
   pnpm install
   pnpm dev
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Option 2: Docker Compose (Cross-platform)

**Prerequisites:**
- Docker Desktop
- Docker Compose

**Setup:**

1. **Clone the repository**
   ```bash
   git clone https://github.com/moming2k/SuperDashboard.git
   cd SuperDashboard
   ```

2. **Configure environment**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your settings
   ```

3. **Start all services**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - PostgreSQL: localhost:5432

**Useful commands:**
```bash
# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

### Option 3: DevContainer (VS Code)

**Prerequisites:**
- VS Code
- Docker Desktop
- Remote - Containers extension

**Setup:**

1. **Clone the repository**
   ```bash
   git clone https://github.com/moming2k/SuperDashboard.git
   cd SuperDashboard
   ```

2. **Open in VS Code**
   ```bash
   code .
   ```

3. **Reopen in Container**
   - Press `F1` or `Cmd+Shift+P`
   - Select "Dev Containers: Reopen in Container"
   - Wait for container to build (first time takes ~5 minutes)

4. **Start services** (inside container)
   ```bash
   # Backend (Terminal 1)
   cd backend
   source venv/bin/activate
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   
   # Frontend (Terminal 2)
   cd frontend
   pnpm dev --host
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000

## Configuration

### Environment Variables

Create `backend/.env` from `backend/.env.example`:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/superdashboard

# OpenAI (for AI features)
OPENAI_API_KEY=sk-...

# Twilio (for WhatsApp)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Jira (optional)
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=...
```

### Database Setup

The application automatically creates all required tables on first run. No manual migration needed!

**Database Schema:**
- Core tables: `plugin_state`, `plugin_config`, `plugin_order`
- DNS Monitor: `dns_monitors`, `dns_monitor_history`, `api_monitors`, `api_monitor_history`
- Notifications: `notifications`, `notification_rules`
- RSS Reader: `rss_feeds`, `rss_articles`
- WhatsApp: `whatsapp_messages`
- Snippets: `snippets`, `snippet_versions`

## Plugin Development

### Creating a New Plugin

1. **Create plugin directory**
   ```bash
   mkdir -p plugins/my-plugin/backend
   mkdir -p plugins/my-plugin/frontend
   ```

2. **Create plugin.json**
   ```json
   {
     "name": "my-plugin",
     "displayName": "My Plugin",
     "description": "Description of my plugin",
     "version": "1.0.0",
     "tab": {
       "label": "My Plugin",
       "icon": "🔌",
       "enabled": true
     },
     "frontendComponent": "MyPlugin"
   }
   ```

3. **Create backend** (`plugins/my-plugin/backend/main.py`)
   ```python
   from fastapi import APIRouter
   
   router = APIRouter()
   
   @router.get("/hello")
   async def hello():
       return {"message": "Hello from my plugin!"}
   ```

4. **Create frontend** (`plugins/my-plugin/frontend/MyPlugin.jsx`)
   ```jsx
   import React from 'react';
   
   export default function MyPlugin() {
     return (
       <div className="animate-fade">
         <h1 className="text-3xl font-bold mb-6">My Plugin</h1>
         <p>Plugin content here</p>
       </div>
     );
   }
   ```

5. **Restart backend** - Plugin will be automatically loaded!

### Database Persistence

Use the shared database for persistence:

```python
from plugins.shared.database import Base, get_db
from sqlalchemy import Column, String, Integer
from fastapi import Depends
from sqlalchemy.orm import Session

class MyModel(Base):
    __tablename__ = "my_table"
    id = Column(Integer, primary_key=True)
    name = Column(String)

@router.get("/items")
async def get_items(db: Session = Depends(get_db)):
    items = db.query(MyModel).all()
    return items
```

## Architecture

```
SuperDashboard/
├── backend/              # FastAPI backend
│   ├── main.py          # Main application
│   ├── services.py      # Core services
│   └── database.py      # Database models
├── frontend/            # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx     # Main app component
│   │   └── plugins/    # Plugin frontend components
│   └── package.json
├── plugins/             # Plugin system
│   ├── shared/         # Shared utilities
│   ├── core/           # Core plugins
│   └── [plugin-name]/  # Individual plugins
│       ├── backend/    # Plugin backend
│       ├── frontend/   # Plugin frontend
│       └── plugin.json # Plugin manifest
└── .devcontainer/      # DevContainer config
```

## Tech Stack

**Frontend:**
- React 18
- Vite
- TailwindCSS
- React Router
- DnD Kit (drag & drop)

**Backend:**
- FastAPI
- SQLAlchemy
- PostgreSQL
- Pydantic
- Python 3.11+

**AI/Integrations:**
- OpenAI GPT-4
- Twilio (WhatsApp)
- Jira Cloud API

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# View PostgreSQL logs
docker logs superdashboard-db

# Reset database
docker-compose down -v
docker-compose up -d
```

### Frontend Build Errors

```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm dev
```

### Plugin Not Loading

1. Check backend logs for errors
2. Verify `plugin.json` is valid JSON
3. Ensure backend router is exported as `router`
4. Check frontend component is exported as default

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

- 📧 Email: support@superdashboard.dev
- 💬 Discord: [Join our community](https://discord.gg/superdashboard)
- 🐛 Issues: [GitHub Issues](https://github.com/moming2k/SuperDashboard/issues)

## Acknowledgments

- Built with ❤️ using FastAPI and React
- Powered by OpenAI GPT-4
- Icons from Emoji
