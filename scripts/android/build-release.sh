#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_dir/fets-point"

# Use the existing Play upload key. Never generate a replacement signing key.
for required in FETS_VERSION_CODE FETS_PREVIOUS_VERSION_CODE FETS_UPLOAD_KEYSTORE FETS_UPLOAD_STORE_PASSWORD FETS_UPLOAD_KEY_ALIAS FETS_UPLOAD_KEY_PASSWORD; do
  if [[ -z "${!required:-}" ]]; then
    echo "Missing $required. Supply it through secure build settings." >&2
    exit 1
  fi
done
if [[ ! "$FETS_VERSION_CODE" =~ ^[0-9]+$ || ! "$FETS_PREVIOUS_VERSION_CODE" =~ ^[0-9]+$ ]]; then
  echo 'Version codes must be integers.' >&2; exit 1
fi
if (( FETS_VERSION_CODE <= FETS_PREVIOUS_VERSION_CODE )); then
  echo 'The new version code must exceed the highest code in Play Console.' >&2; exit 1
fi
[[ -f "$FETS_UPLOAD_KEYSTORE" ]] || { echo 'Upload keystore not found.' >&2; exit 1; }
if [[ -f android/app/google-services.json ]]; then
  node -e "const fs=require('fs');const g=JSON.parse(fs.readFileSync('android/app/google-services.json'));if(!g.client?.some(c=>c.client_info?.android_client_info?.package_name==='com.fets.staffapp'))throw new Error('Firebase configuration must include com.fets.staffapp')"
else
  echo 'Building without Firebase. Android remote push is not enabled.'
fi

cd "$repo_dir"
pnpm --filter fets-point build
cd "$repo_dir/fets-point"
node node_modules/@capacitor/cli/bin/capacitor sync android
./android/gradlew -p android --no-daemon --max-workers=4 bundleRelease
echo "Bundle: $repo_dir/fets-point/android/app/build/outputs/bundle/release/app-release.aab"
echo 'Upload only after the certificate, device tests, listing, and release have been reviewed.'
