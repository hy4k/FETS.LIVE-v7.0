#!/usr/bin/env bash
# Deploy this working tree's reviewed frontend, preserving server config and a rollback image.
set -euo pipefail
cd "$(dirname "$0")/.."
DEPLOY_HOST="${FETS_DEPLOY_HOST:-root@72.61.171.192}"
PUBLIC_URL="${FETS_PUBLIC_URL:-https://fets.live}"
SSH_ARGS=(-o BatchMode=yes)
if [[ -n "${FETS_SSH_KEY:-}" ]]; then SSH_ARGS+=(-i "$FETS_SSH_KEY"); fi
for required in fets-point/src/fets-ai/FetsAIAgent.tsx fets-point/src/redesign/BrandExperience.tsx fets-point/src/redesign/MyDeskHome.tsx fets-point/src/roster/CalendarRosterDialog.tsx; do
  test -f "$required" || { echo "Incomplete checkout: missing $required" >&2; exit 1; }
done
if [[ "${1:-}" != '--built' ]]; then pnpm --filter fets-point build; fi
test -s fets-point/dist/index.html
if [[ -n "$(find fets-point/src fets-point/index.html fets-point/package.json fets-point/vite.config.ts -type f -newer fets-point/dist/index.html -print -quit)" ]]; then
  echo 'The build is older than the source. Build again before deploying.' >&2; exit 1
fi
DEPLOY_RELEASE=$(date -u +%Y%m%dT%H%M%SZ)
DEPLOY_HASH=$(sha256sum fets-point/dist/index.html | cut -d' ' -f1)
DEPLOY_TMP=$(mktemp -d)
trap 'rm -rf "$DEPLOY_TMP"' EXIT
printf '{"release":"%s","index_sha256":"%s","features":["premium-arrival","my-desk","centre-handover","fets-ai","calendar-roster","team-space","mission-seven","shared-workplace"]}\n' "$DEPLOY_RELEASE" "$DEPLOY_HASH" > fets-point/dist/release.json
tar -czf "$DEPLOY_TMP/dist.tar.gz" -C fets-point dist
# Keep a reproducible source snapshot with the release; never include environment files or keys.
tar -czf "$DEPLOY_TMP/source.tar.gz" fets-point/src fets-point/public fets-point/index.html fets-point/package.json fets-point/vite.config.ts fets-point/tsconfig.app.json pnpm-lock.yaml scripts/deploy-reviewed-vps.sh fets-point/deploy-vps.sh scripts/verification supabase/migrations docs/releases
ssh "${SSH_ARGS[@]}" "$DEPLOY_HOST" "mkdir -p /opt/fets-releases/$DEPLOY_RELEASE"
scp "${SSH_ARGS[@]}" "$DEPLOY_TMP/dist.tar.gz" "$DEPLOY_TMP/source.tar.gz" "$DEPLOY_HOST:/opt/fets-releases/$DEPLOY_RELEASE/"
ssh "${SSH_ARGS[@]}" "$DEPLOY_HOST" bash -s -- "$DEPLOY_RELEASE" "$DEPLOY_HASH" <<'REMOTE'
set -euo pipefail
release=$1
expected=$2
cd "/opt/fets-releases/$release"
previous=$(docker inspect fets-live-app-1 --format '{{.Image}}')
printf '%s\n' "$previous" > previous-image
cat /opt/fets-releases/current > previous-release
tar -xzf dist.tar.gz
docker tag "$previous" "fets-live-app:base-$release"
printf 'FROM fets-live-app:base-%s\nRUN rm -rf /usr/share/nginx/html/*\nCOPY dist/ /usr/share/nginx/html/\n' "$release" > Dockerfile
docker build -q -t "fets-live-app:$release" .
check="fets-check-$release"
trap 'docker rm -f "$check" >/dev/null 2>&1 || true' EXIT
docker run --rm -d --name "$check" -p 127.0.0.1:32998:80 "fets-live-app:$release" >/dev/null
for attempt in 1 2 3 4 5; do
  if curl -fsS http://127.0.0.1:32998/calendar -o check.html; then break; fi
  sleep 1
done
test "$(sha256sum check.html | cut -d' ' -f1)" = "$expected"
docker tag "$previous" "fets-live-app:rollback-$release"
docker tag "fets-live-app:$release" fets-live-app:latest
cd /opt/apps/fets-live
if ! docker compose up -d --no-deps --force-recreate app || ! test "$(docker exec fets-live-app-1 sha256sum /usr/share/nginx/html/index.html | cut -d' ' -f1)" = "$expected"; then
  docker tag "$previous" fets-live-app:latest
  docker compose up -d --no-deps --force-recreate app
  echo 'Deployment failed; restored previous image.' >&2
  exit 1
fi
printf '%s' "$release" > /opt/fets-releases/current
docker inspect fets-live-app-1 --format '{{.Image}}'
REMOTE
for attempt in 1 2 3 4 5; do
  if curl -fsS "$PUBLIC_URL/?release=$DEPLOY_RELEASE" -o "$DEPLOY_TMP/live.html" && [[ "$(sha256sum "$DEPLOY_TMP/live.html" | cut -d' ' -f1)" == "$DEPLOY_HASH" ]]; then
    echo "LIVE $DEPLOY_RELEASE $DEPLOY_HASH"
    exit 0
  fi
  sleep 2
done
echo 'Container verified, but public verification failed. Check proxy routing before declaring this release live.' >&2
exit 1
