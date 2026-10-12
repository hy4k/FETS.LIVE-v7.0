#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Deploy the reviewed website first. New workflow actions stay read-only until
# capability version 5 is activated separately through the authorized Supabase tool.
# This script never changes the database or any other Docker service.
COMMIT=deb779c8435dcad0bc2b6c0f91e3b3ae67aceacf
BASELINE=d29a83879be5c5ff48644218f82dfa72f427d83b726c9c01a36c368cf7d9b1f0
PREVIOUS_COMMIT=ad7d353dcbb643a16bfc661b3ce6eaf5eba7257f
APP=/opt/apps/fets-live
CONTAINER=fets-live-app-1
die() { echo "STOP: $*" >&2; exit 1; }
[[ $EUID == 0 ]] || die 'Run this script as root.'
[[ $(hostname -s) == srv1120621 ]] || die 'This script is only for the confirmed FETS Live VPS.'
for cmd in docker git curl python3 sha256sum flock gzip; do
  command -v "$cmd" >/dev/null || die "Missing command: $cmd"
done
exec 9>/var/lock/fets-duty-deploy.lock
flock -n 9 || die 'Another duty-board deployment is running.'
cd "$APP"
docker compose version >/dev/null
[[ $(docker inspect -f '{{.State.Running}}' "$CONTAINER") == true ]] || die 'Expected app container is not running.'
PREVIOUS=$(docker inspect -f '{{.Image}}' "$CONTAINER")
REL="$(date -u +%Y%m%dT%H%M%SZ)-shift-deb779c"
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
git clone --single-branch --branch codex/outcome-duty-workspace https://github.com/hy4k/FETS.LIVE-v7.0.git "$R/source"
git -C "$R/source" fetch origin main:refs/remotes/origin/main
[[ $(git -C "$R/source" rev-parse HEAD) == "$COMMIT" ]] || die 'The PR branch changed. Review it before deploying.'
git -C "$R/source" merge-base --is-ancestor origin/main "$COMMIT" || die 'Main has newer changes. Review them first.'
git -C "$R/source" checkout --detach "$COMMIT"

echo 'Saving the running image, effective configuration, and previous release...'
docker tag "$PREVIOUS" "fets-live-app:rollback-$REL"
docker save "fets-live-app:rollback-$REL" | gzip > "$R/rollback-image.tar.gz"
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
cp "$R/source/docs/releases/sql/2026-10-08-shift-compatibility-rollback.sql" "$R/database-compatibility-rollback.sql"
cp "$R/source/docs/releases/sql/2026-10-08-shift-restore-workflow.sql" "$R/database-restore-workflow.sql"
HASH=$(sha256sum "$R/dist/index.html" | cut -d' ' -f1)
printf '{"release":"%s","commit":"%s","index_sha256":"%s","features":["clear-duty-agreements","staff-support","independent-duty-review","staff-development"]}\n' "$REL" "$COMMIT" "$HASH" > "$R/dist/release.json"
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
docker tag "$(cat previous-image)" fets-live-app:latest
cd /opt/apps/fets-live
docker compose up -d --pull never --no-build --no-deps --force-recreate app
if [[ -f "$release_dir/previous-release" ]]; then
  cp "$release_dir/previous-release" /opt/fets-releases/current
else
  rm -f /opt/fets-releases/current
fi
echo 'Previous website image restored. If workflow version 5 was activated, apply the retained database-compatibility-rollback.sql through Supabase; do not remove any data.'
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
curl --retry 10 --retry-all-errors --retry-delay 2 -fsS --max-time 20 "http://127.0.0.1:$PORT/calendar" -o "$R/candidate.html" || { docker logs --tail 60 "$CHECK" > "$R/candidate.log" 2>&1; die 'Candidate startup failed; production was not switched. Diagnostics are retained in the release directory.'; }
[[ $(sha256sum "$R/candidate.html" | cut -d' ' -f1) == "$HASH" ]] || die 'Candidate route verification failed.'

echo 'Checking for changes made while the build was running...'
[[ $(docker inspect -f '{{.Image}}' "$CONTAINER") == "$PREVIOUS" ]] || die 'Another deployment replaced the running image.'
docker compose config --format json > "$R/compose.pre-switch.json"
cmp -s "$R/compose.before.json" "$R/compose.pre-switch.json" || die 'Server configuration changed during the build.'
git -C "$R/source" fetch origin main:refs/remotes/origin/main codex/outcome-duty-workspace:refs/remotes/origin/codex/outcome-duty-workspace
[[ $(git -C "$R/source" rev-parse origin/codex/outcome-duty-workspace) == "$COMMIT" ]] || die 'The reviewed branch changed during the build.'
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
checks=[('/',dist/'index.html'),('/calendar',dist/'index.html'),('/release.json',dist/'release.json')]
checks += [('/'+p.relative_to(dist).as_posix(),p) for p in (dist/'assets').rglob('*') if p.is_file() and p.suffix in ('.js','.css')]
for url,p in checks:
    expected=p.read_bytes()
    for attempt in range(6):
        try:
            req=urllib.request.Request('https://fets.live'+url+'?release='+release,headers={'Cache-Control':'no-cache'})
            with urllib.request.urlopen(req,timeout=30) as response:
                actual=response.read(); content_type=response.headers.get('Content-Type','').lower()
            if p.suffix=='.js' and 'javascript' not in content_type: raise ValueError('JavaScript MIME type is incorrect')
            if p.suffix=='.css' and 'text/css' not in content_type: raise ValueError('CSS MIME type is incorrect')
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
for k in ['Env','Cmd','Entrypoint','User','WorkingDir','ExposedPorts']:
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
printf '%s\n' "$REL" > "$R/current.new"
mv "$R/current.new" /opt/fets-releases/current
SWITCHED=0
echo "WEBSITE DEPLOYED AND ASSETS VERIFIED: $COMMIT"
echo 'New work actions await the authorized FETS Live database activation. No database change was made by this script.'
echo "Rollback command: bash $R/rollback.sh"
echo 'FETS Online authenticated changeover and break-cover verification remains pending.'
