#!/usr/bin/env bash
#
# Restore costudy on a bare VPS: static frontend + Node API, both behind nginx.
#
#   costudy.in, www.costudy.in   static SPA        (hy4k/costudy)
#   api.costudy.in               Express API :8080 (hy4k/costudy-api)
#
# Unlike fets.live, this app HAS a backend and it NEEDS SECRETS. On the first
# run the script writes a template to /etc/costudy/costudy.env and stops so you
# can fill it in. Nothing works until you do.
#
# Run as root on the VPS:
#   bash restore-costudy.sh
#
# Idempotent — re-running is safe and is the normal way to redeploy.
#
# Flags:
#   --email <addr>   Let's Encrypt contact    (default: midhunnr@gmail.com)
#   --skip-ssl       HTTP only, no certbot
#   --take-ports     stop a proxy (Coolify/Traefik) holding :80
#   --frontend-only  skip the API service
#   --api-only       skip the frontend build
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${HERE}/lib/common.sh"

DOMAIN="costudy.in"
API_DOMAIN="api.costudy.in"
LE_EMAIL="midhunnr@gmail.com"
SKIP_SSL=0
TAKE_PORTS=0
DO_FRONTEND=1
DO_API=1

FE_REPO="https://github.com/hy4k/costudy.git"
API_REPO="https://github.com/hy4k/costudy-api.git"
FE_SRC="/opt/costudy"
API_SRC="/opt/costudy-api"
WEB_ROOT="/var/www/html/${DOMAIN}/public_html"
ENV_DIR="/etc/costudy"
ENV_FILE="${ENV_DIR}/costudy.env"
API_PORT=8080
API_USER="costudy"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)         LE_EMAIL="$2"; shift 2 ;;
    --skip-ssl)      SKIP_SSL=1; shift ;;
    --take-ports)    TAKE_PORTS=1; shift ;;
    --frontend-only) DO_API=0; shift ;;
    --api-only)      DO_FRONTEND=0; shift ;;
    -h|--help)       sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

require_root

# ---------------------------------------------------------------------------
# 1. Secrets
# ---------------------------------------------------------------------------
# These live only on the server, never in the repos. The file is root-only:
# it holds the Supabase service-role key, which bypasses row-level security.
say "Checking configuration"
mkdir -p "$ENV_DIR"
chmod 700 "$ENV_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<'EOF'
# costudy secrets — fill every value in, then re-run the restore script.
# This file is read by the costudy-api systemd unit and by the frontend build.
# Keep it root-only (chmod 600). Never commit it.

# --- Frontend (compiled into the public JS bundle — anon/publishable only) ---
VITE_SUPABASE_URL=https://avtjxcdcjbwmggdimkgh.supabase.co
VITE_SUPABASE_ANON_KEY=
VITE_COSTUDY_API_URL=https://api.costudy.in
GEMINI_API_KEY=
# Razorpay publishable key id (rzp_live_... / rzp_test_...). Leave the SECRET
# out — it must never reach the browser.
VITE_RAZORPAY_KEY_ID=

# --- API (server-side only, never sent to the browser) ---
SUPABASE_URL=https://avtjxcdcjbwmggdimkgh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# --- Optional API tuning (defaults are fine) ---
# CHAT_MODEL=
# CLAUDE_MODEL=
# EMBED_MODEL=
# MATCH_THRESHOLD=
# TOPK=
NODE_ENV=production
PORT=8080
EOF
  chmod 600 "$ENV_FILE"
  cat <<EOF

$(warn "No configuration found — a template has been written to:")

    ${ENV_FILE}

costudy needs secrets that are deliberately NOT in the git repos. Fill them in
and run this script again. You will need:

  VITE_SUPABASE_ANON_KEY      Supabase dashboard → Project Settings → API
  SUPABASE_SERVICE_ROLE_KEY   same page, "service_role" (server-side only)
  GEMINI_API_KEY              Google AI Studio
  ANTHROPIC_API_KEY           console.anthropic.com
  OPENAI_API_KEY              platform.openai.com
  VITE_RAZORPAY_KEY_ID        Razorpay dashboard (only if payments are live)

Edit with:  nano ${ENV_FILE}
EOF
  exit 1
fi

chmod 600 "$ENV_FILE"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Fail loudly listing every missing key at once, rather than one per run.
missing=()
[[ $DO_FRONTEND -eq 1 ]] && {
  [[ -n "${VITE_SUPABASE_ANON_KEY:-}" ]] || missing+=(VITE_SUPABASE_ANON_KEY)
  [[ -n "${GEMINI_API_KEY:-}"         ]] || missing+=(GEMINI_API_KEY)
}
[[ $DO_API -eq 1 ]] && {
  [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]] || missing+=(SUPABASE_SERVICE_ROLE_KEY)
  [[ -n "${ANTHROPIC_API_KEY:-}"         ]] || missing+=(ANTHROPIC_API_KEY)
  [[ -n "${OPENAI_API_KEY:-}"            ]] || missing+=(OPENAI_API_KEY)
}
if [[ ${#missing[@]} -gt 0 ]]; then
  warn "These values are still empty in ${ENV_FILE}:"
  printf '    %s\n' "${missing[@]}" >&2
  die "Fill them in and re-run."
fi
ok "Configuration loaded"

# ---------------------------------------------------------------------------
# 2. Prerequisites
# ---------------------------------------------------------------------------
check_port_80 "$TAKE_PORTS"

say "Installing system packages"
ensure_base_packages
ensure_node 22

# ---------------------------------------------------------------------------
# 3. Frontend
# ---------------------------------------------------------------------------
if [[ $DO_FRONTEND -eq 1 ]]; then
  say "Fetching frontend source"
  sync_repo "$FE_REPO" "$FE_SRC" main
  ok "costudy at $(git -C "$FE_SRC" rev-parse --short HEAD)"

  say "Building frontend"
  cd "$FE_SRC"
  # --include=dev is required: the env file sets NODE_ENV=production for the
  # API, and npm honours that by skipping devDependencies — which is where
  # vite and the TypeScript toolchain live. Without this the build dies with
  # "vite: not found".
  npm_install_deps --include=dev

  # Vite only inlines VITE_* from a .env file in the project root, and
  # vite.config.ts reads GEMINI_API_KEY through loadEnv — so the values have to
  # be written here rather than just exported.
  cat > "$FE_SRC/.env" <<EOF
VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
VITE_COSTUDY_API_URL=${VITE_COSTUDY_API_URL:-https://${API_DOMAIN}}
VITE_RAZORPAY_KEY_ID=${VITE_RAZORPAY_KEY_ID:-}
GEMINI_API_KEY=${GEMINI_API_KEY}
EOF
  chmod 600 "$FE_SRC/.env"

  npm run build
  [[ -f "$FE_SRC/dist/index.html" ]] || die "Frontend build produced no dist/index.html"
  ok "Frontend built"

  say "Publishing frontend to ${WEB_ROOT}"
  mkdir -p "$WEB_ROOT"
  rsync -a --delete --exclude='.well-known' "$FE_SRC/dist/" "$WEB_ROOT/"
  chown -R www-data:www-data "/var/www/html/${DOMAIN}"
  ok "$(find "$WEB_ROOT" -type f | wc -l) files published"

  write_static_vhost "$DOMAIN" "$WEB_ROOT" "${DOMAIN} www.${DOMAIN}"
  ok "vhost written for ${DOMAIN}"
fi

# ---------------------------------------------------------------------------
# 4. API
# ---------------------------------------------------------------------------
if [[ $DO_API -eq 1 ]]; then
  say "Fetching API source"
  sync_repo "$API_REPO" "$API_SRC" main
  ok "costudy-api at $(git -C "$API_SRC" rev-parse --short HEAD)"

  say "Installing API dependencies"
  cd "$API_SRC"
  npm_install_deps --omit=dev

  # Run the API as its own unprivileged user, not root.
  if ! id -u "$API_USER" >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin "$API_USER"
    ok "Created service user: ${API_USER}"
  fi
  chown -R "$API_USER":"$API_USER" "$API_SRC"
  # The env file stays root-only 0600. systemd reads EnvironmentFile as root
  # before dropping to User=, so the service account never needs to read it —
  # and the service-role key it holds bypasses row-level security.

  say "Installing systemd service"
  cat > /etc/systemd/system/costudy-api.service <<EOF
[Unit]
Description=CoStudy API
Documentation=https://github.com/hy4k/costudy-api
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${API_USER}
Group=${API_USER}
WorkingDirectory=${API_SRC}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${API_SRC}/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=costudy-api

# Hardening — the API only ever needs to read its own directory.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${API_SRC}

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable costudy-api >/dev/null 2>&1 || true
  systemctl restart costudy-api

  # Give it a moment, then confirm it actually came up rather than crash-looping.
  sleep 4
  if ! systemctl is-active --quiet costudy-api; then
    journalctl -u costudy-api -n 30 --no-pager >&2 || true
    die "costudy-api failed to start (log above). Check the keys in ${ENV_FILE}."
  fi

  HEALTH="$(curl -s --max-time 10 "http://127.0.0.1:${API_PORT}/health" || true)"
  [[ "$HEALTH" == *'"ok":true'* ]] \
    || die "API is running but /health returned: ${HEALTH:-<nothing>}"
  ok "API healthy on :${API_PORT}"

  write_proxy_vhost "$API_DOMAIN" "$API_PORT"
  ok "vhost written for ${API_DOMAIN}"
fi

# ---------------------------------------------------------------------------
# 5. nginx + TLS
# ---------------------------------------------------------------------------
reload_nginx

if [[ $SKIP_SSL -eq 1 ]]; then
  warn "Skipping SSL (--skip-ssl)"
else
  say "Issuing Let's Encrypt certificates"
  CERT_DOMAINS=()
  [[ $DO_FRONTEND -eq 1 ]] && CERT_DOMAINS+=("$DOMAIN" "www.${DOMAIN}")
  [[ $DO_API      -eq 1 ]] && CERT_DOMAINS+=("$API_DOMAIN")
  issue_cert "$LE_EMAIL" "${CERT_DOMAINS[@]}"
fi

# ---------------------------------------------------------------------------
# 6. Verify
# ---------------------------------------------------------------------------
say "Verifying"
FAILED=0
if [[ $DO_FRONTEND -eq 1 ]]; then
  check_local_http "$DOMAIN" "/" "<div id=\"root\"" || FAILED=1
fi
if [[ $DO_API -eq 1 ]]; then
  check_local_http "$API_DOMAIN" "/health" '"ok":true' || FAILED=1
fi

echo
if [[ $FAILED -eq 0 ]]; then
  ok "costudy restored → https://${DOMAIN}"
  [[ $DO_API -eq 1 ]] && ok "API → https://${API_DOMAIN}/health"
  echo
  echo "Redeploy:      bash ${HERE}/restore-costudy.sh"
  echo "API logs:      journalctl -u costudy-api -f"
  echo "API restart:   systemctl restart costudy-api"
else
  die "Some checks failed — see the warnings above."
fi
