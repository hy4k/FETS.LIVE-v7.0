#!/usr/bin/env bash
#
# Restore fets.live on a bare VPS, from nothing to a live HTTPS site.
#
# Run as root on the VPS (Ubuntu/Debian):
#
#   curl -fsSL https://raw.githubusercontent.com/hy4k/FETS.LIVE-v7.0/main/scripts/vps/restore-fets-live.sh -o restore.sh
#   bash restore.sh
#
# It is idempotent — re-running it is safe and is the normal way to redeploy.
#
# What it does:
#   1. Installs nginx, git, rsync, Node 22, pnpm, certbot
#   2. Clones (or updates) the repo at /opt/fets.live
#   3. Builds the static SPA
#   4. Publishes it to /var/www/html/fets.live/public_html
#   5. Writes an nginx vhost with SPA routing
#   6. Issues a Let's Encrypt certificate and enables HTTPS
#
# The app is a pure static bundle. Supabase hosts the database, auth and edge
# functions, so no secrets and no application server are needed on this box.
#
# Flags:
#   --domain <name>    primary domain            (default: fets.live)
#   --no-www           don't include www.<domain> on the certificate
#   --email <addr>     Let's Encrypt contact     (default: midhunnr@gmail.com)
#   --branch <name>    branch to deploy          (default: main)
#   --skip-ssl         set up HTTP only, no certbot
#   --take-ports       stop a conflicting proxy (Coolify/Traefik) holding :80
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${HERE}/lib/common.sh"

DOMAIN="fets.live"
INCLUDE_WWW=1
LE_EMAIL="midhunnr@gmail.com"
BRANCH="main"
SKIP_SSL=0
TAKE_PORTS=0

REPO_URL="https://github.com/hy4k/FETS.LIVE-v7.0.git"
SRC_DIR="/opt/fets.live"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)     DOMAIN="$2"; shift 2 ;;
    --no-www)     INCLUDE_WWW=0; shift ;;
    --email)      LE_EMAIL="$2"; shift 2 ;;
    --branch)     BRANCH="$2"; shift 2 ;;
    --skip-ssl)   SKIP_SSL=1; shift ;;
    --take-ports) TAKE_PORTS=1; shift ;;
    -h|--help)    sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

WEB_ROOT="/var/www/html/${DOMAIN}/public_html"

require_root

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
check_port_80 "$TAKE_PORTS"

say "Installing system packages"
ensure_base_packages
ensure_node 22
ensure_pnpm

# ---------------------------------------------------------------------------
# 2. Source checkout
# ---------------------------------------------------------------------------
say "Fetching source (${BRANCH})"
sync_repo "$REPO_URL" "$SRC_DIR" "$BRANCH"
ok "At $(git -C "$SRC_DIR" rev-parse --short HEAD)"

# ---------------------------------------------------------------------------
# 3. Build
# ---------------------------------------------------------------------------
say "Building the app (this takes a few minutes on a small VPS)"
cd "$SRC_DIR"
pnpm install --no-frozen-lockfile
pnpm build
[[ -f "$SRC_DIR/fets-point/dist/index.html" ]] \
  || die "Build produced no dist/index.html"
ok "Build complete"

# ---------------------------------------------------------------------------
# 4. Publish
# ---------------------------------------------------------------------------
say "Publishing to ${WEB_ROOT}"
mkdir -p "$WEB_ROOT"
# --delete removes files from previous builds, but .well-known must survive so
# in-flight ACME challenges are not wiped out mid-renewal.
rsync -a --delete --exclude='.well-known' "$SRC_DIR/fets-point/dist/" "$WEB_ROOT/"
chown -R www-data:www-data "/var/www/html/${DOMAIN}"
ok "$(find "$WEB_ROOT" -type f | wc -l) files published"

# ---------------------------------------------------------------------------
# 5. nginx
# ---------------------------------------------------------------------------
say "Writing nginx vhost"
SERVER_NAMES="$DOMAIN"
[[ $INCLUDE_WWW -eq 1 ]] && SERVER_NAMES="$DOMAIN www.$DOMAIN"

write_static_vhost "$DOMAIN" "$WEB_ROOT" "$SERVER_NAMES"
reload_nginx
ok "nginx serving ${SERVER_NAMES} over HTTP"

# ---------------------------------------------------------------------------
# 6. HTTPS
# ---------------------------------------------------------------------------
if [[ $SKIP_SSL -eq 1 ]]; then
  warn "Skipping SSL (--skip-ssl)"
else
  say "Issuing Let's Encrypt certificate"
  CERT_DOMAINS=("$DOMAIN")
  [[ $INCLUDE_WWW -eq 1 ]] && CERT_DOMAINS+=("www.${DOMAIN}")
  issue_cert "$LE_EMAIL" "${CERT_DOMAINS[@]}"
fi

# ---------------------------------------------------------------------------
# 7. Verify
# ---------------------------------------------------------------------------
say "Verifying"
if check_local_http "$DOMAIN" "/"; then
  BUNDLE="$(curl -s --max-time 15 -H "Host: ${DOMAIN}" http://127.0.0.1/ \
    | grep -o 'assets/index-[^"]*\.js' | head -1 || true)"
  [[ -n "$BUNDLE" ]] && ok "Serving bundle: ${BUNDLE}"
  echo
  ok "fets.live restored → https://${DOMAIN}"
  echo
  echo "Redeploy any time with:  bash ${HERE}/restore-fets-live.sh"
else
  die "Local HTTP check failed. Check: journalctl -u nginx -n 50"
fi
