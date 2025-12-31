#!/bin/bash

# Start servers script for devcontainer
# This script starts both backend and frontend servers in the background

set -e

echo "🚀 Starting SuperDashboard servers..."

# Navigate to workspace
cd /workspace

# Start backend server in background
echo "📦 Starting backend server on port 18010..."
cd backend
nohup python main.py > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"
echo $BACKEND_PID > /tmp/backend.pid

# Give backend a moment to start
sleep 2

# Start frontend dev server in background
echo "⚛️  Starting frontend dev server on port 15173..."
cd /workspace/frontend
nohup npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"
echo $FRONTEND_PID > /tmp/frontend.pid

echo ""
echo "🎉 SuperDashboard servers started successfully!"
echo ""
echo "📍 Backend API:        http://localhost:18010"
echo "📍 Frontend Dev:       http://localhost:15173"
echo ""
echo "📝 Backend logs:       tail -f /tmp/backend.log"
echo "📝 Frontend logs:      tail -f /tmp/frontend.log"
echo ""
echo "🛑 To stop servers:"
echo "   kill \$(cat /tmp/backend.pid)"
echo "   kill \$(cat /tmp/frontend.pid)"
echo ""
