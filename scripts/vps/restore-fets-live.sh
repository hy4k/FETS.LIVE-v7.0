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

DOMAIN="fets.live"
INCLUDE_WWW=1
LE_EMAIL="midhunnr@gmail.com"
BRANCH="main"
SKIP_SSL=0
TAKE_PORTS=0

REPO_URL="https://github.com/hy4k/FETS.LIVE-v7.0.git"
SRC_DIR="/opt/fets.live"
NODE_MAJOR=22

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
VHOST="/etc/nginx/sites-available/${DOMAIN}"

say()  { printf '\n\033[1;36m→ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run this as root (or via sudo)."

# ---------------------------------------------------------------------------
# 0. Make sure nothing else already owns port 80
# ---------------------------------------------------------------------------
# A Coolify/Traefik container squatting on :80 is the usual reason a rebuilt
# box answers requests but serves nothing useful. Certbot's HTTP-01 challenge
# also needs port 80, so this has to be settled before anything else.
say "Checking ports 80/443"

# `ss` lives in iproute2, which is not on every minimal image. Install it
# before probing — without it the check below would silently see an empty
# result and wrongly report port 80 as free.
export DEBIAN_FRONTEND=noninteractive
if ! command -v ss >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq iproute2 >/dev/null
fi
command -v ss >/dev/null 2>&1 || die "Could not install iproute2; cannot check port 80."

port_holder() {
  ss -ltnp 2>/dev/null | awk -v p=":$1\$" '$4 ~ p {print $NF}' | head -1
}
HOLDER_80="$(port_holder 80 || true)"

if [[ -n "$HOLDER_80" && "$HOLDER_80" != *nginx* ]]; then
  warn "Port 80 is held by: $HOLDER_80"
  if [[ $TAKE_PORTS -eq 1 ]]; then
    say "Stopping conflicting proxy (--take-ports)"
    if command -v docker >/dev/null 2>&1; then
      # Stop only the proxy container, never the whole Docker daemon — other
      # containers on this host may still be serving something.
      for c in coolify-proxy traefik nginx-proxy caddy; do
        if docker ps --format '{{.Names}}' | grep -qx "$c"; then
          docker stop "$c" && ok "Stopped container: $c"
        fi
      done
    fi
    systemctl stop apache2 2>/dev/null && ok "Stopped apache2" || true
    sleep 2
    HOLDER_80="$(port_holder 80 || true)"
    [[ -z "$HOLDER_80" || "$HOLDER_80" == *nginx* ]] \
      || die "Port 80 still held by $HOLDER_80 — free it manually and re-run."
  else
    cat >&2 <<EOF

Port 80 is not free, so nginx cannot serve ${DOMAIN} and Let's Encrypt
cannot validate the domain.

  • If that proxy is Coolify/Traefik and you are no longer using it here:
        bash $0 --take-ports
  • If you still need it, stop it yourself first, or serve ${DOMAIN}
    through it instead of nginx.

Inspect what is running with:  ss -ltnp | grep -E ':80|:443'   and   docker ps
EOF
    exit 1
  fi
else
  ok "Port 80 is free (or already nginx)"
fi

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
say "Installing system packages"
apt-get update -qq
apt-get install -y -qq \
  nginx git rsync curl ca-certificates gnupg iproute2 >/dev/null
ok "nginx, git, rsync installed"

if ! command -v node >/dev/null 2>&1 || \
   [[ "$(node -v | sed 's/^v\([0-9]*\).*/\1/')" -lt $NODE_MAJOR ]]; then
  say "Installing Node ${NODE_MAJOR}"
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null
fi
ok "Node $(node -v)"

corepack enable >/dev/null 2>&1 || npm install -g corepack >/dev/null 2>&1 || true
corepack prepare pnpm@latest --activate >/dev/null 2>&1 || true
command -v pnpm >/dev/null 2>&1 || npm install -g pnpm >/dev/null 2>&1
ok "pnpm $(pnpm -v)"

# ---------------------------------------------------------------------------
# 2. Source checkout
# ---------------------------------------------------------------------------
say "Fetching source (${BRANCH})"
if [[ -d "$SRC_DIR/.git" ]]; then
  git -C "$SRC_DIR" remote set-url origin "$REPO_URL"
  git -C "$SRC_DIR" fetch origin "$BRANCH" --prune
  git -C "$SRC_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
else
  rm -rf "$SRC_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
fi
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
# 5. nginx vhost
# ---------------------------------------------------------------------------
say "Writing nginx vhost"
SERVER_NAMES="$DOMAIN"
[[ $INCLUDE_WWW -eq 1 ]] && SERVER_NAMES="$DOMAIN www.$DOMAIN"

# Only bind IPv6 where the kernel actually has it. On an IPv6-less host,
# `listen [::]:80` makes nginx refuse to start at all.
LISTEN6=""
if [[ -f /proc/net/if_inet6 ]] && [[ -s /proc/net/if_inet6 ]]; then
  LISTEN6=$'\n    listen [::]:80;'
  ok "IPv6 detected — binding both stacks"
else
  warn "No IPv6 on this host — binding IPv4 only"
fi

# Written HTTP-only. certbot --nginx adds the TLS server block and the
# http→https redirect in step 6.
cat > "$VHOST" <<EOF
server {
    listen 80;${LISTEN6}
    server_name ${SERVER_NAMES};

    root ${WEB_ROOT};
    index index.html;

    # Let's Encrypt HTTP-01 challenge
    location ^~ /.well-known/acme-challenge/ {
        root ${WEB_ROOT};
        try_files \$uri =404;
    }

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # NOTE: nginx's add_header does NOT merge across levels — a block that
    # declares any add_header of its own inherits none from its parent. So the
    # security headers below are repeated in every location that sets a header,
    # otherwise they silently vanish from exactly the HTML responses that need
    # them. Keep them in sync if you edit one.

    # Vite emits content-hashed filenames, so assets can be cached forever.
    # A single Cache-Control (not \`expires\` + add_header, which emits two
    # conflicting headers).
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }

    # index.html must never be cached, or browsers keep loading the old bundle
    # after a deploy and request asset hashes that no longer exist.
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }

    # Client-side routing: unknown paths render the SPA, not a 404.
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }

    access_log /var/log/nginx/${DOMAIN}.access.log;
    error_log  /var/log/nginx/${DOMAIN}.error.log;
}
EOF

ln -sfn "$VHOST" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default

nginx -t || die "nginx config test failed"
systemctl enable nginx >/dev/null 2>&1 || true
systemctl restart nginx
ok "nginx serving ${SERVER_NAMES} over HTTP"

# ---------------------------------------------------------------------------
# 6. HTTPS
# ---------------------------------------------------------------------------
if [[ $SKIP_SSL -eq 1 ]]; then
  warn "Skipping SSL (--skip-ssl)"
else
  say "Issuing Let's Encrypt certificate"
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null

  CERTBOT_DOMAINS=(-d "$DOMAIN")
  [[ $INCLUDE_WWW -eq 1 ]] && CERTBOT_DOMAINS+=(-d "www.$DOMAIN")

  # DNS must already point here or HTTP-01 validation fails.
  RESOLVED="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
  PUBLIC_IP="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
  if [[ -n "$RESOLVED" && -n "$PUBLIC_IP" && "$RESOLVED" != "$PUBLIC_IP" ]]; then
    warn "${DOMAIN} resolves to ${RESOLVED} but this host is ${PUBLIC_IP}."
    warn "Certificate issuance will fail until DNS points here."
  fi

  if certbot --nginx "${CERTBOT_DOMAINS[@]}" \
       --non-interactive --agree-tos --email "$LE_EMAIL" \
       --redirect --keep-until-expiring; then
    systemctl reload nginx
    ok "HTTPS enabled"
  else
    warn "certbot failed — the site is still live over HTTP."
    warn "Fix DNS or port 80 access, then re-run:"
    warn "  certbot --nginx ${CERTBOT_DOMAINS[*]} --redirect -m ${LE_EMAIL} --agree-tos"
  fi

  systemctl enable --now certbot.timer >/dev/null 2>&1 || true
fi

# ---------------------------------------------------------------------------
# 7. Verify
# ---------------------------------------------------------------------------
say "Verifying"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -H "Host: ${DOMAIN}" http://127.0.0.1/ || echo 000)"
BUNDLE="$(curl -s --max-time 15 -H "Host: ${DOMAIN}" http://127.0.0.1/ | grep -o 'assets/index-[^"]*\.js' | head -1 || true)"

echo
if [[ "$CODE" == "200" || "$CODE" == "301" ]]; then
  ok "Local HTTP check: ${CODE}"
  [[ -n "$BUNDLE" ]] && ok "Serving bundle: ${BUNDLE}"
  echo
  ok "fets.live restored → https://${DOMAIN}"
  echo
  echo "Redeploy any time with:  bash ${SRC_DIR}/scripts/vps/restore-fets-live.sh"
else
  die "Local HTTP check returned ${CODE}. Check: journalctl -u nginx -n 50"
fi
