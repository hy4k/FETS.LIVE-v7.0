#!/usr/bin/env bash
# One-command deploy for fets.live
# Site is served via Traefik → Docker container (fets-live-app).
# This script: pull → rebuild container → verify.
#
#   bash deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")"

echo "→ Pulling latest main…"
git fetch origin
git checkout main
git pull --ff-only

echo "→ Rebuilding Docker container…"
docker compose build --no-cache app
docker compose up -d app

echo "→ Waiting for container to be healthy…"
sleep 3

echo "✓ Deployed. Live bundle: $(curl -s https://fets.live/ | grep -o 'assets/index-[^"]*\.js' | head -1)"
