# Restoring fets.live on the VPS

How to bring fets.live back from nothing, and how it stays deployed afterwards.

---

## ⚠️ Read this first: rotate the server credentials

This repository is **public**, and until this change it contained the VPS
`root` password in plain text:

| File | What was exposed |
| --- | --- |
| `scripts/deploy_ssh.js` | host, `root`, password |
| `scratch/test_ssh.js` | host, `root`, password |

Both files have been scrubbed, but **removing them from the working tree does
not remove them from git history** — the credential is still readable in old
commits, in clones, and in anything that scraped the repo while it was there.
Public repositories are scanned by automated bots continuously, so a root
password published this way is typically found within minutes.

Treat the server as compromised and do this before anything else:

1. **Change the root password**, from the Hostinger control panel (hPanel →
   VPS → Settings → Root Password), not over SSH.
2. **Switch to SSH keys and disable password login** — in
   `/etc/ssh/sshd_config` set `PasswordAuthentication no` and
   `PermitRootLogin prohibit-password`, then `systemctl restart ssh`.
3. **Rotate anything else the server held**: Supabase service-role key, API
   keys, `.env` files, and any GitHub deploy keys or Actions secrets.
4. **Prefer rebuilding the VPS from a clean image** over cleaning it in place.
   If an attacker had root, you cannot fully trust the existing filesystem.
   This runbook restores the site onto a blank server in one command, so a
   rebuild costs little.
5. Consider **purging the credential from git history** (`git filter-repo`, or
   BFG) and force-pushing — or, more simply, making the repository private.
   Either way, the password itself must be considered burned and changed.

The Supabase URL and *anon* key hardcoded in `fets-point/src/lib/supabase.ts`
are fine to be public — anon keys are designed to ship in the browser and are
protected by row-level security. Do confirm RLS is actually enabled on every
table. The *service-role* key must never appear in frontend code.

---

## What the site actually is

Worth knowing before restoring, because it makes the job much smaller than it
looks:

- fets.live is a **static single-page app**. `pnpm build` emits plain HTML, JS
  and CSS into `fets-point/dist/`.
- **No application server, no database, no secrets run on the VPS.** Supabase
  hosts the database, auth, storage and edge functions. The browser talks to
  Supabase directly.
- The Supabase connection details are compiled into the bundle, so the build
  needs **no environment variables** — a clean clone builds and runs as-is.

So restoring the site is: build the static files, put them behind nginx, and
get a certificate. Your data was never on the VPS and is unaffected by the
server being wiped.

---

## Current state of the server

As observed from outside (August 2026):

- `72.61.171.192` is up; `fets.live`, `www.fets.live`, `fets.in` and
  `coolify.fets.in` all still resolve to it, so **DNS needs no changes**.
- Port 80 answers with a `308` redirect to HTTPS and sends no `Server` header
  — the signature of a **Traefik proxy, i.e. Coolify**, not nginx.
- Port 443 presents an **untrusted/self-signed certificate** for every
  hostname, meaning no Let's Encrypt certificate and no route matching
  fets.live.

In other words: the box is alive and Coolify's proxy is holding ports 80/443,
but the site content and the nginx configuration that used to serve it are
gone. The restore script handles that port conflict explicitly.

---

## Restoring

Run as root on the VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/hy4k/FETS.LIVE-v7.0/main/scripts/vps/restore-fets-live.sh -o restore.sh
bash restore.sh
```

The script is idempotent — re-running it is safe, and is also the simplest way
to redeploy by hand. It will:

1. Install nginx, git, rsync, Node 22, pnpm and certbot
2. Clone the repo to `/opt/fets.live`
3. Build the SPA
4. Publish it to `/var/www/html/fets.live/public_html`
5. Write an nginx vhost with SPA routing, gzip and cache headers
6. Issue a Let's Encrypt certificate and turn on HTTPS
7. Verify the result against the local nginx

### If it stops at "Port 80 is not free"

That is Coolify's Traefik proxy. Decide which one should own the port:

- **Done with Coolify on this box** — let the script stop the proxy:
  ```bash
  bash restore.sh --take-ports
  ```
  It stops only the proxy container, never the Docker daemon, so anything else
  you are still running stays up.
- **Still using Coolify** — serve fets.live through Coolify instead, or move
  it to a different host. nginx and Traefik cannot both hold port 80.

Inspect what is there with `ss -ltnp | grep -E ':80|:443'` and `docker ps`.

### Options

| Flag | Effect |
| --- | --- |
| `--domain <name>` | Deploy a different domain (default `fets.live`) |
| `--no-www` | Leave `www.` off the certificate |
| `--email <addr>` | Let's Encrypt contact address |
| `--branch <name>` | Deploy a branch other than `main` |
| `--skip-ssl` | HTTP only, no certbot |
| `--take-ports` | Stop a conflicting proxy holding port 80 |

### If certbot fails

The site stays live over HTTP and the script tells you so. The usual causes
are DNS not pointing at the box yet, or port 80 unreachable from outside.
Once fixed:

```bash
certbot --nginx -d fets.live -d www.fets.live --redirect -m you@example.com --agree-tos
```

Renewal is automatic via `certbot.timer`, which the script enables.

---

## Deploying afterwards

Once the server is set up, `deploy.sh` handles ongoing releases — it rebuilds
and swaps the files in the web root, without touching nginx or certificates:

```bash
cd /opt/fets.live && bash deploy.sh
```

`.github/workflows/deploy.yml` does exactly this over SSH on every push to
`main`, once these repository secrets exist:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | server IP or hostname |
| `VPS_USER` | deploy user — **use a non-root user** |
| `VPS_SSH_KEY` | private key whose public half is in that user's `authorized_keys` |

Without them the workflow skips the deploy step and stays green.

Create a dedicated deploy user rather than reusing root:

```bash
adduser --disabled-password --gecos "" deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
# paste the deploy public key into /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /opt/fets.live
# allow just the two commands the deploy needs
cat > /etc/sudoers.d/deploy <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/bin/rsync, /usr/sbin/nginx, /bin/systemctl reload nginx, /bin/mkdir, /bin/chown
EOF
chmod 440 /etc/sudoers.d/deploy
```

---

## costudy

Second site restored. Unlike fets.live it has **two** pieces and it **needs
secrets**:

| Domain | What | Source |
| --- | --- | --- |
| `costudy.in`, `www.costudy.in` | static SPA (Vite/React) | `hy4k/costudy` |
| `api.costudy.in` | Express API on port 8080 | `hy4k/costudy-api` |

All three names already resolve to the VPS, so DNS needs no changes.

```bash
bash scripts/vps/restore-costudy.sh          # add --take-ports if Coolify holds :80
```

### It will stop on the first run — that's intended

The frontend bakes its keys into the public bundle at build time, and the API
reads its own at boot. None of them are in the git repos (correctly). The first
run writes a template to **`/etc/costudy/costudy.env`** and exits so you can
fill it in:

| Key | Where to get it | Goes where |
| --- | --- | --- |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` | browser bundle |
| `GEMINI_API_KEY` | Google AI Studio | browser bundle |
| `VITE_RAZORPAY_KEY_ID` | Razorpay dashboard (only if payments are live) | browser bundle |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → same page → `service_role` | server only |
| `ANTHROPIC_API_KEY` | console.anthropic.com | server only |
| `OPENAI_API_KEY` | platform.openai.com | server only |

The Supabase project is `avtjxcdcjbwmggdimkgh` — a different project from
fets.live's, so its keys are separate.

The file is `chmod 600`, root-only, and stays on the server. systemd reads it as
root before dropping to the `costudy` service account, so the service user never
needs access to it. Anything in the top group is compiled into public JavaScript
— **never put the service-role key or a Razorpay secret there.**

Re-run the script once the file is filled in. It lists every missing key at
once rather than one per run.

### How it runs

The API runs as a systemd unit, `costudy-api.service`, as an unprivileged
`costudy` user with `Restart=always`:

```bash
systemctl status costudy-api
journalctl -u costudy-api -f
systemctl restart costudy-api
curl https://api.costudy.in/health     # {"ok":true,...}
```

nginx reverse-proxies `api.costudy.in` → `127.0.0.1:8080` with 300s read/send
timeouts and buffering off, because the AI endpoints stream for a while and the
60s default would cut long completions off mid-response.

The API's CORS allow-list is hardcoded in `server.js` (`costudy.in`,
`www.costudy.in`, `localhost:5173`). If you add a domain, edit it there.

### Things worth knowing about this codebase

Found while restoring; none block the restore:

- **`package-lock.json` is out of sync with `package.json`** in `hy4k/costudy`
  (missing `d3-path`), so `npm ci` fails outright. The script falls back to
  `npm install` and warns. The repo also carries a `bun.lock`, which is
  probably the lockfile that is actually maintained. Worth regenerating one and
  deleting the other.
- **`NODE_ENV=production` breaks the frontend build** if it leaks into the
  build environment — npm then skips devDependencies, where `vite` lives, and
  the build dies with `vite: not found`. The script passes `--include=dev` to
  defend against this.
- **`VITE_RAZORPAY_KEY_SECRET` is read in `services/paymentService.ts`** but
  never used. Nothing leaks today, but the line is a landmine: setting that
  variable would compile a payment secret into public JavaScript. Delete it.
- **The payment path is currently dead code.** `create-order`, `Razorpay` and
  `purchaseSubscription` are all tree-shaken out of the production bundle, so
  `SubscriptionModal` is not reachable from the app today. Setting
  `VITE_COSTUDY_API_URL` is still correct — it just has no effect yet.
- **`index.html` links `/index.css`, which does not exist in the repo.** Styling
  comes from the Tailwind CDN, so the page renders, but that request is a
  permanent miss. Either add the file or drop the `<link>`.
- **The page depends on `cdn.tailwindcss.com` at runtime**, so the site is not
  self-contained and will not render correctly if that CDN is blocked.
- `COSTUDY_CONFIG.apiBase` points at `https://api.costudy.cloud/v1`, a domain
  that no longer resolves. It is tree-shaken out of the bundle and unused —
  auth goes to Supabase directly — but it is misleading to leave in the source.

---

## Restoring the other sites

The same shape works for any other site that was on this VPS. `scripts/vps/`
now has a small library, `lib/common.sh`, holding the parts every site needs —
package and Node install, the port-80 conflict check, static and reverse-proxy
vhost writers, certificate issuance, and verification. A new site is usually a
short script on top of it; `restore-costudy.sh` is the fuller example, since it
covers both a static frontend and a backend service.

Restore them one at a time and confirm each is live before starting the next.

Check per site before you begin:

- Does DNS still point at this server? (`getent hosts <domain>`)
- Is it static, or does it need a runtime, a database, or secrets?
- Which secrets, and where will they come from? They are not in the repos.
- Was it deployed through Coolify? If so, decide whether to rebuild it there or
  move it to nginx alongside the rest.

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| 502 / 503 | `journalctl -u nginx -n 50`, `nginx -t` |
| Blank page, console 404s on `/assets/*` | Stale `index.html` cached — the vhost sets `no-store`; hard-reload |
| Deep links 404 | SPA fallback missing; confirm `try_files $uri $uri/ /index.html` |
| Certificate warnings | `certbot certificates`, `systemctl status certbot.timer` |
| Build fails, out of memory | Small VPS — add swap: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile` |
