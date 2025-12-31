#!/bin/bash

# Restart servers script for devcontainer
# This script restarts both backend and frontend servers

echo "🔄 Restarting SuperDashboard servers..."
echo ""

# Stop servers first
/workspace/.devcontainer/stop-servers.sh

echo ""
echo "⏳ Waiting 2 seconds..."
sleep 2
echo ""

# Start servers again
/workspace/.devcontainer/start-servers.sh
