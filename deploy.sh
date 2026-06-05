#!/usr/bin/env bash
# One-command deploy for fets.live
# (the domain is served by the host nginx from a static root, not by Coolify)
#
#   bash deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")"

echo "→ Pulling latest main…"
git fetch origin
git checkout main
git pull --ff-only

echo "→ Building…"
cd fets-point
corepack enable >/dev/null 2>&1 || true
pnpm install --no-frozen-lockfile
pnpm build

echo "→ Publishing to nginx web root…"
sudo rsync -a --delete --exclude='.well-known' dist/ /var/www/html/fets.live/public_html/
sudo nginx -t && sudo systemctl reload nginx

echo "✓ Deployed. Live bundle: $(curl -s https://fets.live/ | grep -o 'assets/index-[^"]*\.js' | head -1)"
