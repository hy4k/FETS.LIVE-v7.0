#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
COMMIT=b1b423c8e8aa079fe881af15992540f0183302b8
REL=20261022T105909Z-roster-b1b423c
R=/opt/fets-releases/$REL
APP=/opt/apps/fets-live
CONTAINER=fets-live-app-1
die() { echo "STOP: $*" >&2; exit 1; }
[[ $EUID == 0 && $(hostname -s) == srv1120621 ]] || die 'Unexpected execution host.'
exec 9>/var/lock/fets-duty-deploy.lock
flock -n 9 || die 'A deployment is already running.'
cd "$APP"
[[ $(git -C "$R/source" rev-parse HEAD) == "$COMMIT" ]] || die 'Unexpected source commit.'
git -C "$R/source" diff --exit-code --quiet HEAD -- || die 'Tracked source was modified.'
[[ $(sha256sum "$R/source/scripts/releases/deploy-roster.sh" | cut -d' ' -f1) == 7828f4bf0371b25a8efb0ee63a1df8e48fd852032ba8974d9211dc5ea48ffbcb ]] || die 'Release script changed.'
PREVIOUS=$(cat "$R/previous-image")
[[ $PREVIOUS == sha256:50a5940a3b0a670f63cf02c4a40b6cd10f4b10192feda4b483b83691d1fb0eb0 ]] || die 'Unexpected rollback image.'
[[ $(docker inspect -f '{{.State.Running}}' "$CONTAINER") == true ]] || die 'Production is not running.'
[[ $(docker inspect -f '{{.Image}}' "$CONTAINER") == "$PREVIOUS" ]] || die 'Production changed.'
NEW_IMAGE=$(docker image inspect -f '{{.Id}}' "fets-live-app:$REL")
[[ $NEW_IMAGE == sha256:d3e2757bb870db101ef3dc6fb74ae99f1732d13e3d6eb07fa46f896201e411b8 ]] || die 'Candidate image changed.'
HASH=$(sha256sum "$R/dist/index.html" | cut -d' ' -f1)
docker compose config --format json > "$R/compose.resume.json"
cmp -s "$R/compose.before.json" "$R/compose.resume.json" || die 'Compose configuration changed.'
docker inspect "$CONTAINER" > "$R/container.resume.json"
python3 - "$R" "$COMMIT" "$HASH" <<'PY_CHECK'
import json,pathlib,sys
r=pathlib.Path(sys.argv[1]);b=json.loads((r/'container.before.json').read_text())[0];a=json.loads((r/'container.resume.json').read_text())[0]
for key in ['Env','Cmd','Entrypoint','User','WorkingDir','ExposedPorts']:
 assert a['Config'].get(key)==b['Config'].get(key), 'Runtime configuration changed: '+key
for key in ['PortBindings','NetworkMode','RestartPolicy','ReadonlyRootfs','Privileged','CapAdd','CapDrop','Memory','MemorySwap','NanoCpus','SecurityOpt','ExtraHosts']:
 assert a['HostConfig'].get(key)==b['HostConfig'].get(key), 'Host configuration changed: '+key
mounts=lambda c: sorted((m.get('Type'),m.get('Source'),m.get('Destination'),m.get('RW'),m.get('Propagation')) for m in c.get('Mounts',[]))
assert mounts(a)==mounts(b), 'Mount configuration changed'
release=json.loads((r/'dist/release.json').read_text())
assert release['commit']==sys.argv[2] and release['index_sha256']==sys.argv[3], 'Candidate metadata mismatch'
PY_CHECK
[[ -s "$R/rollback-image.tar.gz" && -x "$R/rollback.sh" ]] || die 'Rollback release incomplete.'
gzip -t "$R/rollback-image.tar.gz"
echo 'Rollback archive and current runtime verified; resuming the built candidate.'
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

echo 'Evaluating the full production application module before switching...'
docker run --rm --user 0 --network host --shm-size=512m \
  -e FETS_PUPPETEER_MODULE=/home/pptruser/node_modules/puppeteer/lib/puppeteer/puppeteer.js \
  -e PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer \
  -v "$R/source/scripts/verification:/checks:ro" \
  ghcr.io/puppeteer/puppeteer:25.13.0 \
  node /checks/verify-production-shell.mjs "http://127.0.0.1:$PORT" > "$R/module-verification.json"
echo "CANDIDATE READY: $R"
touch "$R/candidate.ready"
# A separate authenticated operator writes this receipt only after verifying
# the exact migration on FETS Live. Never auto-apply a migration from this script.
for ((attempt=0; attempt<240; attempt++)); do
  [[ -f "$R/database-verified.json" ]] && break
  sleep 5
done
[[ -f "$R/database-verified.json" ]] || die 'Database verification receipt not received; production was not switched.'
python3 - "$R" <<'PY_GATE'
import hashlib,json,pathlib,sys
r=pathlib.Path(sys.argv[1]); receipt=json.loads((r/'database-verified.json').read_text())
migration=r/'source/supabase/migrations/20261020144716_roster_shift_times_and_attendance.sql'
assert receipt['project_id']=='qqewusetilxxfvfkmsed', 'Wrong database project'
assert receipt['migration_sha256']==hashlib.sha256(migration.read_bytes()).hexdigest(), 'Migration differs from the verified file'
report_migration=r/'source/supabase/migrations/20261022105031_roster_private_attendance_reports.sql'
assert receipt['report_migration_sha256']==hashlib.sha256(report_migration.read_bytes()).hexdigest(), 'Private-report migration differs from the verified file'
assert receipt['verified'] is True, 'Database verification is incomplete'
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
git -C "$R/source" fetch origin main:refs/remotes/origin/main codex/roster-flexible-shifts:refs/remotes/origin/codex/roster-flexible-shifts
[[ $(git -C "$R/source" rev-parse origin/codex/roster-flexible-shifts) == "$COMMIT" ]] || die 'The reviewed branch changed during the build.'
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
checks=[('/',dist/'index.html'),('/calendar',dist/'index.html'),('/roster',dist/'index.html'),('/release.json',dist/'release.json')]
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
echo 'FETS Live roster migration was verified before the website switch. Existing records are retained.'
echo "Rollback command: bash $R/rollback.sh"
echo 'FETS Online and its existing walk/DVR integration were not changed.'
