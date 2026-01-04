#!/bin/bash
# SuperDashboard Local Development Setup
# Creates isolated virtual environments for backend and frontend
# Prevents system Python pollution

set -e  # Exit on error

echo "🚀 Setting up SuperDashboard development environment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Python 3.11+ is installed
echo "Checking Python version..."
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.11 or later."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1-2)
REQUIRED_VERSION="3.11"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    print_error "Python $REQUIRED_VERSION or later is required. You have Python $PYTHON_VERSION"
    exit 1
fi

print_success "Python $PYTHON_VERSION detected"
echo ""

# ==================== Backend Setup ====================
echo "📦 Setting up backend virtual environment..."

cd backend

# Check if uv is installed
if command -v uv &> /dev/null; then
    print_success "uv detected - using fast package manager (10-100x faster!)"

    # Create virtual environment with uv
    if [ ! -d ".venv" ]; then
        echo "Creating .venv with uv..."
        uv venv .venv
        print_success "Virtual environment created"
    else
        print_warning ".venv already exists, skipping creation"
    fi

    # Activate and install dependencies from pyproject.toml
    echo "Installing dependencies with uv from pyproject.toml..."
    source .venv/bin/activate
    uv pip install -e .
    print_success "Dependencies installed with uv"
else
    print_warning "uv not found - falling back to pip (slower)"
    echo "💡 Install uv for 10-100x faster installs: curl -LsSf https://astral.sh/uv/install.sh | sh"
    echo ""

    # Create virtual environment with venv
    if [ ! -d ".venv" ]; then
        echo "Creating .venv..."
        python3 -m venv .venv
        print_success "Virtual environment created"
    else
        print_warning ".venv already exists, skipping creation"
    fi

    # Activate and install dependencies from pyproject.toml
    echo "Installing dependencies with pip from pyproject.toml..."
    source .venv/bin/activate
    pip install --upgrade pip
    pip install -e .
    print_success "Dependencies installed with pip"
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating .env from template..."
    cp .env.example .env
    print_warning ".env created - please configure your API keys!"
    echo "   Edit backend/.env and add:"
    echo "   - DATABASE_URL (required)"
    echo "   - OPENAI_API_KEY (optional, for AI features)"
    echo "   - JIRA credentials (optional, for Jira plugin)"
else
    print_success ".env already exists"
fi

deactivate
cd ..

echo ""
print_success "Backend setup complete!"
echo ""

# ==================== Frontend Setup ====================
echo "📦 Setting up frontend..."

cd frontend

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18 or later."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_warning "Node.js 18+ recommended. You have Node.js $NODE_VERSION"
fi

print_success "Node.js $(node --version) detected"

# Install dependencies
echo "Installing frontend dependencies..."
npm install
print_success "Frontend dependencies installed"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "Creating frontend .env from template..."
    cp .env.example .env
    print_success ".env created"
else
    print_success ".env already exists"
fi

cd ..

echo ""
print_success "Frontend setup complete!"
echo ""

# ==================== Database Setup ====================
echo "🗄️  Database setup..."

# Check if PostgreSQL is installed
if command -v psql &> /dev/null; then
    print_success "PostgreSQL detected"
    echo "   Make sure PostgreSQL is running and DATABASE_URL is configured in backend/.env"
elif command -v docker &> /dev/null; then
    print_warning "PostgreSQL not found locally, but Docker is available"
    echo "   You can use Docker to run PostgreSQL:"
    echo "   docker-compose up -d db"
else
    print_warning "PostgreSQL not detected"
    echo "   Install PostgreSQL or use Docker: docker-compose up -d db"
fi

echo ""

# ==================== Summary ====================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
print_success "Setup complete! 🎉"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Configure environment variables:"
echo "   cd backend && nano .env"
echo ""
echo "2. Start the backend (in one terminal):"
echo "   cd backend"
echo "   source .venv/bin/activate  # Activate virtual environment"
echo "   python main.py"
echo ""
echo "3. Start the frontend (in another terminal):"
echo "   cd frontend"
echo "   npm run dev"
echo ""
echo "4. Access the application:"
echo "   - Backend API: http://localhost:8000"
echo "   - Frontend: http://localhost:5173"
echo "   - API Docs: http://localhost:8000/docs"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Tips:"
echo "   - Always activate the virtual environment before running Python commands"
echo "   - Use 'deactivate' to exit the virtual environment"
echo "   - Install uv for 10-100x faster package installation"
echo "   - Use docker-compose for a complete stack with PostgreSQL"
echo ""
