#!/usr/bin/env bash
# AttendBridge stop (Linux/macOS)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1

if systemctl is-active --quiet attendbridge 2>/dev/null; then
  sudo systemctl stop attendbridge
  echo "AttendBridge service stopped. (It will start again on boot; use ./uninstall-service.sh to remove it.)"
elif command -v pm2 &>/dev/null && pm2 describe attendbridge &>/dev/null; then
  pm2 stop attendbridge
  echo "AttendBridge stopped (PM2)."
elif [ -f logs/server.pid ] && kill -0 "$(cat logs/server.pid)" 2>/dev/null; then
  kill "$(cat logs/server.pid)" && rm -f logs/server.pid
  echo "AttendBridge stopped."
else
  echo "No running server found."
fi
