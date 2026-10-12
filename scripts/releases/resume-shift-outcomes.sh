#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
APP=/opt/apps/fets-live
CONTAINER=fets-live-app-1
COMMIT=deb779c8435dcad0bc2b6c0f91e3b3ae67aceacf
R=${1:?Pass the prepared release directory.}
R=$(realpath "$R")
die() { echo "STOP: $*" >&2; exit 1; }
[[ $EUID == 0 && $(hostname -s) == srv1120621 ]] || die 'Use the confirmed FETS Live VPS root terminal.'
[[ $(dirname "$R") == /opt/fets-releases && $(basename "$R") =~ ^[0-9]{8}T[0-9]{6}Z-shift-deb779c$ && -d "$R" ]] || die 'Unexpected release directory.'
exec 9>/var/lock/fets-duty-deploy.lock
flock -n 9 || die 'Another deployment is running.'
cd "$APP"
REL=$(basename "$R")
PREVIOUS=$(cat "$R/previous-image")
[[ $(docker inspect -f '{{.Image}}' "$CONTAINER") == "$PREVIOUS" ]] || die 'The running image changed after rollback.'
[[ $(git -C "$R/source" rev-parse HEAD) == "$COMMIT" ]] || die 'Prepared source changed.'
git -C "$R/source" fetch origin main:refs/remotes/origin/main codex/outcome-duty-workspace:refs/remotes/origin/codex/outcome-duty-workspace
[[ $(git -C "$R/source" rev-parse origin/codex/outcome-duty-workspace) == "$COMMIT" ]] || die 'The reviewed branch changed.'
git -C "$R/source" merge-base --is-ancestor origin/main "$COMMIT" || die 'Main has newer changes.'
docker compose config --format json > "$R/compose.resume.json"
cmp -s "$R/compose.before.json" "$R/compose.resume.json" || die 'Compose configuration changed.'
curl -fsS --max-time 30 https://fets.live/ -o "$R/public.resume.html"
cmp -s "$R/public.before.html" "$R/public.resume.html" || die 'Public production changed after rollback.'
python3 -S - "$R/dist/release.json" "$COMMIT" <<'PY'
import json,sys
assert json.load(open(sys.argv[1]))['commit']==sys.argv[2], 'Prepared release metadata changed'
PY
# Check the saved attempt before changing production; compare environment by
# unique variable name and value, preserving all other configuration guards.
python3 -S - "$R" <<'PY'
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
# Preserve the original attempt's evidence and validate the rolled-back server.
cp "$R/container.after.json" "$R/container.failed-attempt.json"
docker inspect "$CONTAINER" > "$R/container.after.json"
if [[ -d "$R/nginx.after" ]]; then mv "$R/nginx.after" "$R/nginx.saved-$(date -u +%Y%m%dT%H%M%S%N)"; fi
docker cp "$CONTAINER:/etc/nginx" "$R/nginx.after"
python3 -S - "$R" <<'PY'
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
NEXT=$(docker image inspect -f '{{.Id}}' "fets-live-app:$REL")
CHECK="fets-shift-resume-$REL"
SWITCHED=0
cleanup() {
  result=$?
  trap - EXIT
  docker rm -f "$CHECK" >/dev/null 2>&1 || true
  if (( result != 0 && SWITCHED == 1 )); then
    echo 'Verification failed; restoring the previous image.' >&2
    bash "$R/rollback.sh" || echo "ROLLBACK NEEDS ATTENTION: bash $R/rollback.sh" >&2
  fi
  exit "$result"
}
trap cleanup EXIT
HASH=$(sha256sum "$R/dist/index.html" | cut -d' ' -f1)
echo 'Checking the already-built candidate; no rebuild is needed...'
docker run --rm -d --name "$CHECK" --env-file "$R/runtime.env" --volumes-from "$CONTAINER:ro" -p 127.0.0.1::80 "fets-live-app:$REL" >/dev/null
PORT=$(docker port "$CHECK" 80/tcp | head -n1 | awk -F: '{print $NF}')
curl --retry 10 --retry-all-errors --retry-delay 2 -fsS --max-time 20 "http://127.0.0.1:$PORT/calendar" -o "$R/candidate.resume.html"
[[ $(sha256sum "$R/candidate.resume.html" | cut -d' ' -f1) == "$HASH" ]] || die 'Candidate route verification failed.'
[[ $(docker inspect -f '{{.Image}}' "$CONTAINER") == "$PREVIOUS" ]] || die 'Another deployment replaced the app.'
docker compose config --format json > "$R/compose.resume-pre-switch.json"
cmp -s "$R/compose.resume.json" "$R/compose.resume-pre-switch.json" || die 'Compose configuration changed during candidate checks.'
curl -fsS --max-time 30 https://fets.live/ -o "$R/public.resume-pre-switch.html"
cmp -s "$R/public.before.html" "$R/public.resume-pre-switch.html" || die 'Public production changed during candidate checks.'
echo 'Starting the verified Shift website...'
SWITCHED=1
docker tag "$NEXT" fets-live-app:latest
docker compose up -d --pull never --no-build --no-deps --force-recreate app
[[ $(docker inspect -f '{{.Image}}' "$CONTAINER") == "$NEXT" ]] || die 'Unexpected running image.'
python3 -S - "$R/dist" "$REL" <<'PY'
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
if [[ -d "$R/nginx.after" ]]; then mv "$R/nginx.after" "$R/nginx.saved-$(date -u +%Y%m%dT%H%M%S%N)"; fi
docker cp "$CONTAINER:/etc/nginx" "$R/nginx.after"
python3 -S - "$R" <<'PY'
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
printf '%s\n' "$REL" > "$R/current.new"
mv "$R/current.new" /opt/fets-releases/current
SWITCHED=0
echo "WEBSITE DEPLOYED AND ASSETS VERIFIED: $COMMIT"
echo "Rollback command: bash $R/rollback.sh"
echo 'FETS Live database activation is pending. No database records were changed by this script.'
