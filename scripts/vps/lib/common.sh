#!/usr/bin/env bash
# Shared helpers for the VPS restore scripts in this directory.
#
# Source it, don't run it:
#   source "$(dirname "$0")/lib/common.sh"
#
# Every site restore needs the same handful of things — packages, Node, a free
# port 80, an nginx vhost, a certificate — so they live here once.

say()  { printf '\n\033[1;36m→ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive

require_root() {
  [[ $EUID -eq 0 ]] || die "Run this as root (or via sudo)."
}

# --------------------------------------------------------------------------
# Packages
# --------------------------------------------------------------------------
apt_install() {
  apt-get install -y -qq "$@" >/dev/null
}

ensure_base_packages() {
  apt-get update -qq
  apt_install nginx git rsync curl ca-certificates gnupg iproute2
  ok "nginx, git, rsync installed"
}

ensure_node() {
  local major="${1:-22}"
  if command -v node >/dev/null 2>&1 && \
     [[ "$(node -v | sed 's/^v\([0-9]*\).*/\1/')" -ge $major ]]; then
    ok "Node $(node -v)"
    return
  fi
  say "Installing Node ${major}"
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${major}.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt_install nodejs
  ok "Node $(node -v)"
}

# `npm ci` is the right default — it installs exactly the lockfile and is
# reproducible. But it hard-fails when a committed package-lock.json has
# drifted out of sync with package.json, which is easy to do in a repo that is
# also managed with bun. A stale lockfile must not block a site restore, so
# fall back to `npm install` and say so.
#
#   npm_install_deps [extra npm args...]
npm_install_deps() {
  if npm ci --no-audit --no-fund "$@"; then
    return 0
  fi
  warn "npm ci failed — package-lock.json is out of sync with package.json."
  warn "Falling back to 'npm install' (resolves fresh; not byte-reproducible)."
  npm install --no-audit --no-fund "$@" \
    || die "npm install failed — cannot build."
}

# Clone or update a deploy checkout, discarding local drift.
#
# A hard reset matters here: the npm/pnpm fallbacks below rewrite lockfiles in
# place, so without it the checkout accumulates modifications that eventually
# collide with a fetch.
#
#   sync_repo <url> <dir> [branch]
sync_repo() {
  local url="$1" dir="$2" branch="${3:-main}"
  if [[ -d "$dir/.git" ]]; then
    git -C "$dir" remote set-url origin "$url"
    git -C "$dir" fetch origin "$branch" --prune
    git -C "$dir" checkout -B "$branch" "origin/${branch}"
    git -C "$dir" reset --hard "origin/${branch}"
    git -C "$dir" clean -fd -e node_modules -e .env -e dist
  else
    rm -rf "$dir"
    git clone --branch "$branch" "$url" "$dir"
  fi
}

ensure_pnpm() {
  corepack enable >/dev/null 2>&1 || npm install -g corepack >/dev/null 2>&1 || true
  corepack prepare pnpm@latest --activate >/dev/null 2>&1 || true
  command -v pnpm >/dev/null 2>&1 || npm install -g pnpm >/dev/null 2>&1
  ok "pnpm $(pnpm -v)"
}

# --------------------------------------------------------------------------
# Port 80
# --------------------------------------------------------------------------
# A Coolify/Traefik container squatting on :80 is the usual reason a rebuilt
# box answers requests but serves nothing useful. certbot's HTTP-01 challenge
# needs the port too, so this has to be settled before anything else.
#
#   check_port_80 <take_ports:0|1>
check_port_80() {
  local take="${1:-0}" holder

  # `ss` lives in iproute2, which is not on every minimal image. Install it
  # before probing — without it the check would see an empty result and
  # wrongly report port 80 as free.
  if ! command -v ss >/dev/null 2>&1; then
    apt-get update -qq
    apt_install iproute2
  fi
  command -v ss >/dev/null 2>&1 || die "Could not install iproute2; cannot check port 80."

  holder="$(ss -ltnp 2>/dev/null | awk '$4 ~ /:80$/ {print $NF}' | head -1 || true)"

  if [[ -z "$holder" || "$holder" == *nginx* ]]; then
    ok "Port 80 is free (or already nginx)"
    return 0
  fi

  warn "Port 80 is held by: $holder"
  if [[ "$take" != "1" ]]; then
    cat >&2 <<EOF

Port 80 is not free, so nginx cannot serve this site and Let's Encrypt cannot
validate the domain.

  • If that proxy is Coolify/Traefik and you are no longer using it here,
    re-run this script with --take-ports
  • If you still need it, stop it yourself, or serve the site through it

Inspect with:  ss -ltnp | grep -E ':80|:443'   and   docker ps
EOF
    exit 1
  fi

  say "Stopping conflicting proxy (--take-ports)"
  if command -v docker >/dev/null 2>&1; then
    # Stop only the proxy container, never the Docker daemon — other
    # containers on this host may still be serving something.
    for c in coolify-proxy traefik nginx-proxy caddy; do
      if docker ps --format '{{.Names}}' | grep -qx "$c"; then
        docker stop "$c" >/dev/null && ok "Stopped container: $c"
      fi
    done
  fi
  systemctl stop apache2 2>/dev/null && ok "Stopped apache2" || true
  sleep 2

  holder="$(ss -ltnp 2>/dev/null | awk '$4 ~ /:80$/ {print $NF}' | head -1 || true)"
  [[ -z "$holder" || "$holder" == *nginx* ]] \
    || die "Port 80 still held by $holder — free it manually and re-run."
  ok "Port 80 freed"
}

# --------------------------------------------------------------------------
# nginx
# --------------------------------------------------------------------------
# Only bind IPv6 where the kernel actually has it. On an IPv6-less host,
# `listen [::]:80` makes nginx refuse to start at all.
nginx_listen6() {
  if [[ -s /proc/net/if_inet6 ]]; then
    printf '\n    listen [::]:80;'
  fi
}

# The security headers repeated by the vhost writers below.
#
# nginx's add_header does NOT merge across levels — a block that declares any
# add_header of its own inherits none from its parent. Declared only at server
# level they vanish from exactly the HTML responses that need them, so every
# location that sets a header has to restate them.
NGINX_SECURITY_HEADERS='    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;'

#   write_static_vhost <domain> <web_root> <server_names>
# A single-page-app vhost: SPA fallback, gzip, hashed-asset caching.
write_static_vhost() {
  local domain="$1" web_root="$2" server_names="$3"
  local vhost="/etc/nginx/sites-available/${domain}"

  cat > "$vhost" <<EOF
server {
    listen 80;$(nginx_listen6)
    server_name ${server_names};

    root ${web_root};
    index index.html;

    location ^~ /.well-known/acme-challenge/ {
        root ${web_root};
        try_files \$uri =404;
    }

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # Build tools content-hash these filenames, so they cache forever. One
    # Cache-Control header, not \`expires\` plus add_header (which emits two
    # conflicting ones).
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
${NGINX_SECURITY_HEADERS}
    }

    # index.html must never be cached, or browsers keep loading the old bundle
    # after a deploy and request asset hashes that no longer exist.
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;
        add_header Pragma "no-cache" always;
${NGINX_SECURITY_HEADERS}
    }

    # Client-side routing: unknown paths render the SPA, not a 404.
    location / {
        try_files \$uri \$uri/ /index.html;
${NGINX_SECURITY_HEADERS}
    }

    access_log /var/log/nginx/${domain}.access.log;
    error_log  /var/log/nginx/${domain}.error.log;
}
EOF

  ln -sfn "$vhost" "/etc/nginx/sites-enabled/${domain}"
}

#   write_proxy_vhost <domain> <upstream_port> [acme_root]
# Reverse proxy in front of a local service — for API subdomains.
write_proxy_vhost() {
  local domain="$1" port="$2" acme_root="${3:-/var/www/html/${1}/public_html}"
  local vhost="/etc/nginx/sites-available/${domain}"

  mkdir -p "$acme_root"

  cat > "$vhost" <<EOF
server {
    listen 80;$(nginx_listen6)
    server_name ${domain};

    location ^~ /.well-known/acme-challenge/ {
        root ${acme_root};
        try_files \$uri =404;
    }

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        "upgrade";

        # AI calls in this API stream for a while before finishing; the 60s
        # default would cut long completions off mid-response.
        proxy_connect_timeout 30s;
        proxy_send_timeout    300s;
        proxy_read_timeout    300s;
        proxy_buffering       off;

        client_max_body_size 25m;
    }

    access_log /var/log/nginx/${domain}.access.log;
    error_log  /var/log/nginx/${domain}.error.log;
}
EOF

  ln -sfn "$vhost" "/etc/nginx/sites-enabled/${domain}"
}

reload_nginx() {
  rm -f /etc/nginx/sites-enabled/default
  nginx -t || die "nginx config test failed"
  systemctl enable nginx >/dev/null 2>&1 || true
  systemctl restart nginx
  ok "nginx reloaded"
}

# --------------------------------------------------------------------------
# TLS
# --------------------------------------------------------------------------
#   issue_cert <email> <domain> [more domains...]
issue_cert() {
  local email="$1"; shift
  local -a args=()
  local d
  for d in "$@"; do args+=(-d "$d"); done

  apt_install certbot python3-certbot-nginx

  # DNS must already point here or HTTP-01 validation fails. Warn rather than
  # abort: the operator may be mid-cutover and the site still works on HTTP.
  local resolved public_ip
  resolved="$(getent hosts "$1" | awk '{print $1}' | head -1 || true)"
  public_ip="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
  if [[ -n "$resolved" && -n "$public_ip" && "$resolved" != "$public_ip" ]]; then
    warn "$1 resolves to ${resolved} but this host is ${public_ip}."
    warn "Certificate issuance will fail until DNS points here."
  fi

  if certbot --nginx "${args[@]}" \
       --non-interactive --agree-tos --email "$email" \
       --redirect --keep-until-expiring; then
    systemctl reload nginx
    ok "HTTPS enabled for: $*"
  else
    warn "certbot failed — the site is still live over HTTP."
    warn "Fix DNS or port 80 reachability, then run:"
    warn "  certbot --nginx ${args[*]} --redirect -m ${email} --agree-tos"
  fi

  systemctl enable --now certbot.timer >/dev/null 2>&1 || true
}

# --------------------------------------------------------------------------
# Verification
# --------------------------------------------------------------------------
# Ask the local nginx directly rather than going out over the internet, so the
# check reports what this box serves even before DNS or a CDN catches up.
#
#   check_local_http <host_header> [path] [expected_substring]
check_local_http() {
  local host="$1" path="${2:-/}" expect="${3:-}"
  local code body
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
            -H "Host: ${host}" "http://127.0.0.1${path}" || echo 000)"

  if [[ "$code" != "200" && "$code" != "301" && "$code" != "302" ]]; then
    warn "${host}${path} → HTTP ${code}"
    return 1
  fi

  if [[ -n "$expect" ]]; then
    body="$(curl -s --max-time 20 -H "Host: ${host}" "http://127.0.0.1${path}" || true)"
    if [[ "$body" != *"$expect"* ]]; then
      warn "${host}${path} → ${code} but body lacked '${expect}'"
      return 1
    fi
  fi

  ok "${host}${path} → ${code}"
}
