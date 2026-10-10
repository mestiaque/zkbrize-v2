#!/usr/bin/env bash
# Remove the ZK Bridge systemd service
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1
sudo "$(command -v node)" scripts/service.js uninstall
