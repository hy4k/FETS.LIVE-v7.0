#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Deploy My Desk time insights and the merged F Vault after verifying the existing Live-only request backend.
# This script never changes the database or any other Docker service.
COMMIT=${1:?Pass the exact reviewed Git commit.}
BASELINE=d193a41e723df78125de8a65a067b21825bd128a43be4240a7cb1d7c65b90114
PREVIOUS_COMMIT=d712bae63b785eefff2c398e89b35a37a672d53e
APP=/opt/apps/fets-live
CONTAINER=fets-live-app-1
die() { echo "STOP: $*" >&2; exit 1; }
[[ $COMMIT =~ ^[a-f0-9]{40}$ ]] || die 'Pass a complete reviewed commit hash.'
[[ $EUID == 0 ]] || die 'Run this script as root.'
[[ $(hostname -s) == srv1120621 ]] || die 'This script is only for the confirmed FETS Live VPS.'
for cmd in docker git curl python3 sha256sum flock gzip; do
  command -v "$cmd" >/dev/null || die "Missing command: $cmd"
done
exec 9>/var/lock/fets-duty-deploy.lock
flock -n 9 || die 'Another FETS Live deployment is running.'
cd "$APP"
docker compose version >/dev/null
[[ $(docker inspect -f '{{.State.Running}}' "$CONTAINER") == true ]] || die 'Expected app container is not running.'
PREVIOUS=$(docker inspect -f '{{.Image}}' "$CONTAINER")
REL="$(date -u +%Y%m%dT%H%M%SZ)-my-desk-${COMMIT:0:7}"
R="/opt/fets-releases/$REL"
mkdir -p "$R"
[[ $(df -Pk "$R" | awk 'NR==2 {print $4}') -ge 5242880 ]] || die 'At least 5 GiB free disk space is required for the isolated build.'
docker inspect "$CONTAINER" > "$R/container.before.json"
docker compose config --format json > "$R/compose.before.json"
docker compose config > "$R/compose.resolved.yaml"
docker image inspect "$PREVIOUS" > "$R/image.before.json"
python3 - "$R" "$APP" <<'PY'
import json, pathlib, sys
r=pathlib.Path(sys.argv[1]); app=sys.argv[2]
c=json.loads((r/'container.before.json').read_text())[0]
s=json.loads((r/'compose.before.json').read_text())['services']['app']
assert s.get('image') in (None, 'fets-live-app', 'fets-live-app:latest'), 'Unexpected Compose image; inspect before deploying.'
assert c['Config']['Image'] in ('fets-live-app', 'fets-live-app:latest'), 'Unexpected running image.'
assert c['Config']['Labels'].get('com.docker.compose.project') == 'fets-live', 'Unexpected Compose project.'
labels=c['Config'].get('Labels') or {}
assert labels.get('com.docker.compose.service') == 'app', 'Unexpected service.'
assert labels.get('com.docker.compose.project.working_dir') == app, 'Unexpected Compose directory.'
assert c['Config'].get('Cmd') == json.loads((r/'image.before.json').read_text())[0]['Config'].get('Cmd'), 'Compose command override needs separate inspection.'
assert c['Config'].get('Entrypoint') == json.loads((r/'image.before.json').read_text())[0]['Config'].get('Entrypoint'), 'Compose entrypoint override needs separate inspection.'
assert not any(m['Destination'] == '/' or '/usr/share/nginx/html'.startswith(m['Destination'].rstrip('/')+'/') or m['Destination'].startswith('/usr/share/nginx/html') for m in c.get('Mounts',[])), 'Web-root mount needs a different deployment method.'
env=c['Config'].get('Env') or []
assert all('\n' not in x and '\r' not in x for x in env), 'Multiline runtime environment needs manual inspection.'
(r/'runtime.env').write_text('\n'.join(env)+'\n')
PY
curl -fsS --max-time 30 https://fets.live/release.json -o "$R/release.before.json"
python3 - "$R/release.before.json" "$PREVIOUS_COMMIT" <<'PY'
import json,sys
assert json.load(open(sys.argv[1]))['commit']==sys.argv[2], 'The public release changed; review it before deploying.'
PY
curl -fsS --max-time 30 https://fets.live/ -o "$R/public.before.html"
[[ $(sha256sum "$R/public.before.html" | cut -d' ' -f1) == "$BASELINE" ]] || die 'Production changed since inspection. No deployment made; send this message back.'
[[ $(docker exec "$CONTAINER" sha256sum /usr/share/nginx/html/index.html | cut -d' ' -f1) == "$BASELINE" ]] || die 'The container and public site differ. No deployment made.'

echo 'Checking out the reviewed commit and checking repository changes...'
git clone --single-branch --branch codex/my-desk-time-insights https://github.com/hy4k/FETS.LIVE-v7.0.git "$R/source"
git -C "$R/source" fetch origin main:refs/remotes/origin/main
[[ $(git -C "$R/source" rev-parse HEAD) == "$COMMIT" ]] || die 'The PR branch changed. Review it before deploying.'
git -C "$R/source" merge-base --is-ancestor origin/main "$COMMIT" || die 'Main has newer changes. Review them first.'
git -C "$R/source" checkout --detach "$COMMIT"

echo 'Saving the running image, effective configuration, and previous release...'
docker tag "$PREVIOUS" "fets-live-app:rollback-$REL"
docker save "fets-live-app:rollback-$REL" | gzip -1 > "$R/rollback-image.tar.gz"
docker cp "$CONTAINER:/etc/nginx" "$R/nginx.before"
printf '%s\n' "$PREVIOUS" > "$R/previous-image"
if [[ -f /opt/fets-releases/current ]]; then cp /opt/fets-releases/current "$R/previous-release"; fi

# Preserve the existing explicitly configured public frontend build arguments.
python3 - "$R" <<'PY'
import json,pathlib,sys
r=pathlib.Path(sys.argv[1]); c=json.loads((r/'compose.before.json').read_text())
b=c['services']['app'].get('build') or {}
args=b.get('args') or {} if isinstance(b,dict) else {}
values={k:str(v) for k,v in args.items() if k.startswith('VITE_') and v is not None}
(r/'source/fets-point/.env.production.local').write_text(''.join(k+'='+json.dumps(v)+'\n' for k,v in values.items()))
PY
echo 'Building the reviewed frontend in an isolated Node container...'
docker run --rm --memory 2g --memory-swap 3g -v "$R/source:/app" -w /app node:24-bookworm-slim sh -ec '
  npx --yes pnpm@11.19.0 install --frozen-lockfile --ignore-scripts
  npx --yes pnpm@11.19.0 --filter fets-point build
'
cp -a "$R/source/fets-point/dist" "$R/dist"
find "$R/dist" -type d -exec chmod 755 {} +
find "$R/dist" -type f -exec chmod 644 {} +
python3 - "$R/dist" <<'PY_BUILD'
import pathlib, sys
root=pathlib.Path(sys.argv[1])
assert list((root/'assets').glob('manrope-*.woff2')), 'Bundled Manrope font is missing'
assert (root/'licenses/Manrope-OFL.txt').is_file(), 'Font license is missing'
for p in (root/'assets').glob('*.js'):
    content=p.read_text()
    assert all(marker not in content for marker in ('LOCAL DESIGN PREVIEW', 'CPR-EXAMPLE', 'previewTime', 'Design preview · fictional staff records', 'Design preview · fictional centre records','PRIVATE SOURCE · fictional','fictional-message')), 'Training fixture found in production assets'
PY_BUILD
HASH=$(sha256sum "$R/dist/index.html" | cut -d' ' -f1)
python3 - "$R" "$REL" "$COMMIT" "$HASH" <<'PY_METADATA'
import json,pathlib,sys
r=pathlib.Path(sys.argv[1]); previous=json.loads((r/'release.before.json').read_text())
features=list(dict.fromkeys(previous['features']+['my-desk-time-insights','merged-f-vault','half-day-requests','consented-shift-swaps','personal-work-rhythm']))
(r/'dist/release.json').write_text(json.dumps({'release':sys.argv[2],'commit':sys.argv[3],'index_sha256':sys.argv[4],'features':features},separators=(',',':'))+'\n')
PY_METADATA
chmod 644 "$R/dist/release.json"
docker tag "$PREVIOUS" "fets-live-app:base-$REL"
# Retain old hashed assets so existing browser sessions can finish loading them.
printf 'FROM fets-live-app:base-%s\nCOPY dist/ /usr/share/nginx/html/\n' "$REL" > "$R/Dockerfile"
printf '*\n!Dockerfile\n!dist/\n!dist/**\n' > "$R/.dockerignore"
docker build -t "fets-live-app:$REL" -f "$R/Dockerfile" "$R"
NEW_IMAGE=$(docker image inspect -f '{{.Id}}' "fets-live-app:$REL")

cat > "$R/rollback.sh" <<'ROLLBACK'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
release_dir=$PWD
if ! docker image inspect "$(cat previous-image)" >/dev/null 2>&1; then
  gzip -dc "$release_dir/rollback-image.tar.gz" | docker load
fi
docker tag "$(cat previous-image)" fets-live-app:latest
cd /opt/apps/fets-live
docker compose up -d --pull never --no-build --no-deps --force-recreate app
if [[ -f "$release_dir/previous-release" ]]; then
  cp "$release_dir/previous-release" /opt/fets-releases/current
else
  rm -f /opt/fets-releases/current
fi
echo 'Previous website image restored. The existing backend and all recorded data are retained.'
ROLLBACK
chmod 700 "$R/rollback.sh"
SWITCHED=0
CHECK="fets-duty-check-$REL"
cleanup() {
  result=$?
  trap - EXIT
  docker rm -f "$CHECK" >/dev/null 2>&1 || true
  if (( result != 0 && SWITCHED == 1 )); then
    echo 'Verification failed; restoring the previous website image.' >&2
    bash "$R/rollback.sh" || echo "ROLLBACK NEEDS ATTENTION: bash $R/rollback.sh" >&2
  fi
  exit "$result"
}
trap cleanup EXIT
echo 'Testing the candidate with the existing runtime environment and mounted configuration...'
docker run --rm -d --name "$CHECK" --env-file "$R/runtime.env" --volumes-from "$CONTAINER:ro" -p 127.0.0.1::80 "fets-live-app:$REL" >/dev/null
PORT=$(docker port "$CHECK" 80/tcp | head -n1 | awk -F: '{print $NF}')
curl --retry 10 --retry-all-errors --retry-delay 2 -fsS --max-time 20 "http://127.0.0.1:$PORT/news-manager" -o "$R/candidate.html" || { docker logs --tail 60 "$CHECK" > "$R/candidate.log" 2>&1; die 'Candidate startup failed; production was not switched. Diagnostics are retained in the release directory.'; }
[[ $(sha256sum "$R/candidate.html" | cut -d' ' -f1) == "$HASH" ]] || die 'Candidate route verification failed.'

echo 'Evaluating the full production application module before switching...'
docker run --rm --user 0 --network host --shm-size=512m \
  -e FETS_PUPPETEER_MODULE=/home/pptruser/node_modules/puppeteer/lib/puppeteer/puppeteer.js \
  -e PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer \
  -v "$R/source/scripts/verification:/checks:ro" \
  ghcr.io/puppeteer/puppeteer:25.13.0 \
  node /checks/verify-production-shell.mjs "http://127.0.0.1:$PORT" > "$R/module-verification.json"
echo "CANDIDATE READY: $R"
touch "$R/candidate.ready"
# Retain prior Sites/News/Shift receipts and verify the already-applied request backend.
PREVIOUS_RELEASE=20261028T062113Z-sites-d712bae
[[ $(cat /opt/fets-releases/current) == "$PREVIOUS_RELEASE" ]] || die 'Previous release pointer changed.'
cp "/opt/fets-releases/$PREVIOUS_RELEASE/database-verified.json" "$R/database-verified.json"
python3 - "$R" "$PREVIOUS_COMMIT" "$COMMIT" <<'PY_GATE'
import hashlib,json,pathlib,subprocess,sys
r=pathlib.Path(sys.argv[1]);receipt=json.loads((r/'database-verified.json').read_text())
assert receipt['project_id']=='qqewusetilxxfvfkmsed' and receipt['verified'] is True
assert receipt['staff_day_shift']['verified'] is True
assert receipt['news']['verified'] is True and receipt['news']['approval_required'] is True
assert receipt['sites']['verified'] is True and receipt['sites']['migration']['version']=='20261028061819'
desk=json.loads((r/'source/docs/releases/2026-10-28-my-desk-backend.json').read_text())
assert desk['verified'] is True and desk['project_id']=='qqewusetilxxfvfkmsed'
assert desk['migration']['version']=='20261028022657' and desk['isolated_checks']>=17
assert desk['public_functions_invoker_only'] is True and desk['anonymous_execute'] is False
assert hashlib.sha256((r/'source'/desk['migration']['path']).read_bytes()).hexdigest()==desk['migration']['sha256']
changed=subprocess.check_output(['git','-C',str(r/'source'),'diff','--name-only',sys.argv[2],sys.argv[3],'--','supabase/'],text=True).strip()
assert set(changed.splitlines())=={desk['migration']['path']}, 'Unexpected backend changes; review before deploying'
receipt['personal_desk']=desk
(r/'database-verified.json').write_text(json.dumps(receipt,indent=2)+'\n')
PY_GATE

echo 'Checking for changes made while the build was running...'
[[ $(docker inspect -f '{{.Image}}' "$CONTAINER") == "$PREVIOUS" ]] || die 'Another deployment replaced the running image.'
docker compose config --format json > "$R/compose.pre-switch.json"
cmp -s "$R/compose.before.json" "$R/compose.pre-switch.json" || die 'Server configuration changed during the build.'
docker cp "$CONTAINER:/etc/nginx" "$R/nginx.pre-switch"
python3 - "$R" <<'PY_NGINX'
import hashlib,pathlib,sys
r=pathlib.Path(sys.argv[1])
def tree(p):
    return {str(f.relative_to(p)):hashlib.sha256(f.read_bytes()).hexdigest() for f in p.rglob('*') if f.is_file()}
assert tree(r/'nginx.before') == tree(r/'nginx.pre-switch'), 'Nginx changed during the build; production was not switched'
PY_NGINX
git -C "$R/source" fetch origin main:refs/remotes/origin/main codex/my-desk-time-insights:refs/remotes/origin/codex/my-desk-time-insights
[[ $(git -C "$R/source" rev-parse origin/codex/my-desk-time-insights) == "$COMMIT" ]] || die 'The reviewed branch changed during the build.'
git -C "$R/source" merge-base --is-ancestor origin/main "$COMMIT" || die 'Main changed during the build.'
curl -fsS --max-time 30 https://fets.live/ -o "$R/public.pre-switch.html"
cmp -s "$R/public.before.html" "$R/public.pre-switch.html" || die 'Public production changed during the build.'
echo 'Switching only the FETS Live app service...'
SWITCHED=1
docker tag "$NEW_IMAGE" fets-live-app:latest
docker compose up -d --pull never --no-build --no-deps --force-recreate app
[[ $(docker inspect -f '{{.Image}}' "$CONTAINER") == "$NEW_IMAGE" ]] || die 'Compose did not start the candidate image.'

echo 'Verifying public HTML, routes, release metadata, and every built JavaScript/CSS asset...'
python3 - "$R/dist" "$REL" <<'PY'
import pathlib,sys,time,urllib.request
dist=pathlib.Path(sys.argv[1]); release=sys.argv[2]
checks=[('/',dist/'index.html'),('/calendar',dist/'index.html'),('/roster',dist/'index.html'),('/news-manager',dist/'index.html'),('/system-manager',dist/'index.html'),('/my-desk',dist/'index.html'),('/release.json',dist/'release.json')]
checks += [('/licenses/Manrope-OFL.txt',dist/'licenses/Manrope-OFL.txt')]
checks += [('/'+p.relative_to(dist).as_posix(),p) for p in (dist/'assets').rglob('*') if p.is_file() and p.suffix in ('.js','.css','.woff2')]
for url,p in checks:
    expected=p.read_bytes()
    for attempt in range(6):
        try:
            req=urllib.request.Request('https://fets.live'+url+'?release='+release,headers={'Cache-Control':'no-cache'})
            with urllib.request.urlopen(req,timeout=30) as response:
                actual=response.read(); content_type=response.headers.get('Content-Type','').lower()
            if p.suffix=='.js' and 'javascript' not in content_type: raise ValueError('JavaScript MIME type is incorrect')
            if p.suffix=='.css' and 'text/css' not in content_type: raise ValueError('CSS MIME type is incorrect')
            if p.suffix=='.woff2' and not any(t in content_type for t in ('font/woff2','application/font-woff2','application/octet-stream')): raise ValueError('Font MIME type is incorrect')
            if actual==expected: break
        except Exception: pass
        time.sleep(2)
    else: raise SystemExit('Public verification failed: '+url)
print('Verified',len(checks),'public files/routes against the reviewed build.')
PY
docker inspect "$CONTAINER" > "$R/container.after.json"
docker cp "$CONTAINER:/etc/nginx" "$R/nginx.after"
python3 - "$R" <<'PY'
import json,pathlib,sys,hashlib
r=pathlib.Path(sys.argv[1])
b=json.loads((r/'container.before.json').read_text())[0]
a=json.loads((r/'container.after.json').read_text())[0]
def envmap(c):
    entries=c['Config'].get('Env') or []
    values=dict(item.split('=',1) for item in entries)
    assert len(values)==len(entries), 'Duplicate environment variable names require inspection'
    return values
assert envmap(a)==envmap(b), 'Runtime environment names or values changed'
for k in ['Cmd','Entrypoint','User','WorkingDir','ExposedPorts']:
    assert a['Config'].get(k)==b['Config'].get(k), 'Runtime configuration changed: '+k
for k in ['PortBindings','NetworkMode','RestartPolicy','ReadonlyRootfs','Privileged','CapAdd','CapDrop','Memory','MemorySwap','NanoCpus','SecurityOpt','ExtraHosts']:
    assert a['HostConfig'].get(k)==b['HostConfig'].get(k), 'Host configuration changed: '+k
mounts=lambda c: sorted((m.get('Type'),m.get('Source'),m.get('Destination'),m.get('RW'),m.get('Propagation')) for m in c.get('Mounts',[]))
assert mounts(a)==mounts(b), 'Mounted server configuration changed'
def tree(directory):
    return {str(p.relative_to(directory)):hashlib.sha256(p.read_bytes()).hexdigest() for p in directory.rglob('*') if p.is_file()}
assert tree(r/'nginx.before')==tree(r/'nginx.after'), 'Nginx configuration changed'
print('Existing runtime, ports, mounts, restart policy and Nginx configuration preserved.')
PY
echo 'Evaluating the full application module on the public site...'
docker run --rm --user 0 --network host --shm-size=512m \
 -e FETS_PUPPETEER_MODULE=/home/pptruser/node_modules/puppeteer/lib/puppeteer/puppeteer.js \
 -e PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer \
 -v "$R/source/scripts/verification:/checks:ro" \
 ghcr.io/puppeteer/puppeteer:25.13.0 \
 node /checks/verify-production-shell.mjs https://fets.live > "$R/module-public-verification.json"
printf '%s\n' "$REL" > "$R/current.new"
mv "$R/current.new" /opt/fets-releases/current
SWITCHED=0
echo "WEBSITE DEPLOYED AND ASSETS VERIFIED: $COMMIT"
echo 'My Desk time insights, separate applications and merged F Vault are deployed.'
echo "Rollback command: bash $R/rollback.sh"
echo 'Existing records and backend receipts are retained; runtime and Nginx settings were preserved.'
