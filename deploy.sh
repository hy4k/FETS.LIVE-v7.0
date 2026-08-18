#!/usr/bin/env bash
# One-command redeploy for fets.live.
#
# The domain is served by the host nginx from a static root — the app is a
# pure static bundle with no server side, so a deploy is just "build, then
# swap the files in the web root".
#
#   bash deploy.sh
#
# This assumes the server has already been set up. If it hasn't (fresh or
# rebuilt VPS: no nginx, no web root, no certificate), run this instead:
#
#   bash scripts/vps/restore-fets-live.sh
#
set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="${DOMAIN:-fets.live}"
WEB_ROOT="/var/www/html/${DOMAIN}/public_html"
BRANCH="${BRANCH:-main}"

# Only use sudo when we aren't already root, so this works both under a deploy
# user and as root.
SUDO=""
[[ $EUID -ne 0 ]] && SUDO="sudo"

echo "→ Pulling latest ${BRANCH}…"
git fetch origin "$BRANCH" --prune
git checkout -B "$BRANCH" "origin/${BRANCH}"

echo "→ Building…"
corepack enable >/dev/null 2>&1 || true
pnpm install --no-frozen-lockfile
pnpm build

if [[ ! -f fets-point/dist/index.html ]]; then
  echo "✗ Build produced no dist/index.html — refusing to publish." >&2
  exit 1
fi

echo "→ Publishing to ${WEB_ROOT}…"
$SUDO mkdir -p "$WEB_ROOT"
# --delete clears out old content-hashed assets; .well-known is preserved so an
# in-flight ACME renewal isn't wiped mid-challenge.
$SUDO rsync -a --delete --exclude='.well-known' fets-point/dist/ "$WEB_ROOT/"
$SUDO chown -R www-data:www-data "/var/www/html/${DOMAIN}"

$SUDO nginx -t && $SUDO systemctl reload nginx

# Ask the local nginx directly rather than going out over the internet, so the
# check reports what this box is serving even before DNS or a CDN catches up.
BUNDLE="$(curl -s --max-time 15 -H "Host: ${DOMAIN}" http://127.0.0.1/ \
  | grep -o 'assets/index-[^"]*\.js' | head -1 || true)"
echo "✓ Deployed. Live bundle: ${BUNDLE:-<none found>}"
