#!/bin/bash

# Stop servers script for devcontainer
# This script stops both backend and frontend servers

echo "🛑 Stopping SuperDashboard servers..."

# Stop backend
if [ -f /tmp/backend.pid ]; then
    BACKEND_PID=$(cat /tmp/backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        kill $BACKEND_PID
        echo "✅ Backend server stopped (PID: $BACKEND_PID)"
    else
        echo "⚠️  Backend server not running"
    fi
    rm /tmp/backend.pid
else
    echo "⚠️  Backend PID file not found"
fi

# Stop frontend
if [ -f /tmp/frontend.pid ]; then
    FRONTEND_PID=$(cat /tmp/frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        kill $FRONTEND_PID
        echo "✅ Frontend server stopped (PID: $FRONTEND_PID)"
    else
        echo "⚠️  Frontend server not running"
    fi
    rm /tmp/frontend.pid
else
    echo "⚠️  Frontend PID file not found"
fi

# Also kill any remaining python/node processes on our ports
pkill -f "python main.py" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo ""
echo "✅ All servers stopped"
