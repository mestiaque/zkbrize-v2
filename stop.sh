#!/usr/bin/env bash
# ZK Bridge stop (Linux/macOS)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1

if systemctl is-active --quiet zk-bridge 2>/dev/null; then
  sudo systemctl stop zk-bridge
  echo "ZK Bridge service stopped. (It will start again on boot; use ./uninstall-service.sh to remove it.)"
elif command -v pm2 &>/dev/null && pm2 describe zk-bridge &>/dev/null; then
  pm2 stop zk-bridge
  echo "ZK Bridge stopped (PM2)."
elif [ -f logs/server.pid ] && kill -0 "$(cat logs/server.pid)" 2>/dev/null; then
  kill "$(cat logs/server.pid)" && rm -f logs/server.pid
  echo "ZK Bridge stopped."
else
  echo "No running server found."
fi
