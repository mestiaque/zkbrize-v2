#!/usr/bin/env bash
# AttendBridge launcher (Linux/macOS)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1

if ! command -v node &>/dev/null; then
  echo "[ERROR] Node.js not found! Install Node.js 20+ from https://nodejs.org"
  exit 1
fi

# Install dependencies if needed (setup runs automatically after install)
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install || { echo "[ERROR] npm install failed!"; exit 1; }
else
  node scripts/setup.js
fi

PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]\r')
PORT=${PORT:-3000}
URL="http://localhost:$PORT"

# Installed as a systemd service? Then just make sure it is running.
if [ -f /etc/systemd/system/attendbridge.service ]; then
  if ! systemctl is-active --quiet attendbridge; then
    echo "Starting attendbridge service..."
    sudo systemctl start attendbridge
  fi
# Start or restart with PM2
elif command -v pm2 &>/dev/null; then
  if pm2 describe attendbridge &>/dev/null; then
    pm2 restart attendbridge --update-env
  else
    pm2 start ecosystem.config.js
  fi
else
  # Fallback: run directly in background
  if [ -f logs/server.pid ] && kill -0 "$(cat logs/server.pid)" 2>/dev/null; then
    kill "$(cat logs/server.pid)"
    sleep 1
  fi
  nohup node src/server.js > logs/server.log 2>&1 &
  echo "Server started (no PM2). Logs: logs/server.log"
fi

# Wait for server to be ready
echo "Waiting for server..."
for i in {1..15}; do
  curl -s "$URL" > /dev/null 2>&1 && break
  sleep 1
done
echo "Server is running at $URL"

# Open browser (only when a desktop is available)
if [ -n "$DISPLAY$WAYLAND_DISPLAY" ]; then
  if command -v xdg-open &>/dev/null; then
    xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open &>/dev/null; then
    open "$URL"
  fi
fi
