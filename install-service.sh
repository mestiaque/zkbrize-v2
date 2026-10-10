#!/usr/bin/env bash
# Install AttendBridge as a systemd service (starts on boot)
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1
[ -d node_modules ] || npm install || exit 1
./stop.sh >/dev/null 2>&1
sudo "$(command -v node)" scripts/service.js install
