# FETS LIVE mobile update

This update is prepared from main at `a8272897d7a9107fa9d8e7b153bf6b7af68e8d67`.
The existing Play application remains `com.fets.staffapp`, in account
`8990490185328662382`. No Play Console access, upload, or rollout has occurred.
The user requested a production rollout after review.

## What changed

Phones use the same Calendar, Roster, Candidate Tracker, My Desk, Shift,
Actionables, Team Space, AI, and administrative feature components as the web.
The former reduced mobile routes are no longer used. A five-destination bottom
bar keeps daily work accessible; More contains searchable tools with the same
role defaults and personal permission overrides as the web workspace.
The mobile header, layouts, input sizes, safe areas, offline guidance, and
Android back behavior are designed for touch. Desktop navigation remains.

Brand assets are in `fets-point/assets` and `fets-point/public/brand`.
Native adaptive icons and splash resources are in the Android project.
Store graphics and screenshots are in `release/play-store`. Screenshot data
is synthetic; these are web-rendered phone previews, not Android device captures.
They must be reviewed on the actual signed Android build before publication.

## Locate the existing upload key on your computer

Remote Desktop Commander exposed no callable tools in this session. These
steps run on the computer that holds the original key, not in this cloud machine.
Search the old Android project, Android Studio projects, Downloads, Documents,
and your backup drive for `.jks`, `.keystore`, and `keystore.properties`.
Do not paste passwords or file contents into chat. On Windows PowerShell:

```powershell
$folders = @("$env:USERPROFILE\Documents", "$env:USERPROFILE\Downloads", "$env:USERPROFILE\Desktop")
Get-ChildItem -Path $folders -Recurse -File -Include *.jks,*.keystore,keystore.properties -ErrorAction SilentlyContinue |
  Select-Object FullName
# Repeat with the root of the drive where you keep project backups.
```

For each candidate keystore, use the JDK's command below. Enter the password
locally when prompted, and compare the SHA-256 certificate fingerprint with
the **upload key certificate** in Play Console → app signing/app integrity.
When Play App Signing is enabled, the upload certificate can differ from the
app signing certificate. Do not generate a new upload key to bypass this check.

```sh
keytool -list -v -keystore /path/to/existing-upload-key.jks
```

## Release prerequisites

1. Verify the app and account in Play Console. Check the highest version code
   across all tracks, not just production. The owner verified all 16 uploaded
   versions and confirmed that `34 (2.10.0)` is the highest and current production
   release. The proposed update is code `35`, version name `7.1.0`; recheck if
   any other release is uploaded before this one.
2. Restore the matching upload keystore and its alias/passwords through secure
   build settings. Never commit these files or passwords.
3. Firebase is optional. The owner reports that the existing setup did not use
   `google-services.json`, and none was found in the available repository history.
   Build without it. If Android remote push is configured later, place a matching
   `google-services.json` in `fets-point/android/app/` before building. Without
   that configuration, the app skips Android push permission and registration;
   app startup and signing do not depend on Firebase.
4. Install JDK 21 (including javac), Android SDK platform 36 and build-tools 36.0.0.
   The generated Gradle wrapper uses 8.14.3 with a verified distribution checksum.
   Capacitor 8 requires Android 7/API 24 or newer; compare device support with
   the existing release before rollout. Do not silently drop supported users.
5. Set `ANDROID_HOME` or Android `local.properties` for the SDK. Supply existing
   network access to Supabase and the existing notification/AI integrations.

## Build

On Windows, extract the prepared project and double-click
`BUILD-ANDROID-RELEASE.cmd`. The helper uses the owner's verified keystore at
`C:\Users\mithu\fets-upload-key\upload-keystore.jks`, alias `upload`, and prompts
locally for passwords. It does not require or prompt for Firebase configuration.
Node.js, pnpm, JDK 21 and
Android SDK 36 must be installed first. The helper builds locally and does not
publish. Its PowerShell syntax is checked in the cloud; execution on the
owner's Windows computer and signed-release validation remain pending.

From the repository root, install with the existing frozen pnpm workspace
lockfile. Do not run a separate install in fets-point that rewrites its lockfile.

```sh
pnpm install --frozen-lockfile
pnpm --filter fets-point build
cd fets-point
node node_modules/@capacitor/cli/bin/capacitor sync android
./android/gradlew -p android assembleDebug
```

For a release, securely supply `FETS_UPLOAD_KEYSTORE` (absolute path),
`FETS_UPLOAD_STORE_PASSWORD`, `FETS_UPLOAD_KEY_ALIAS`, `FETS_UPLOAD_KEY_PASSWORD`,
`FETS_PREVIOUS_VERSION_CODE` (verified highest Console code), and
`FETS_VERSION_CODE` (higher unused code). Optionally set `FETS_VERSION_NAME`;
the proposed default is `7.1.0`. Then run from the repository root:

```sh
bash scripts/android/build-release.sh
```

The AAB is `fets-point/android/app/build/outputs/bundle/release/app-release.aab`.
The script builds current web assets, syncs native plugins, and signs using the
existing upload key. It never uploads or publishes. Direct Gradle release tasks
also require signing variables and a non-template version code.

## Review before production

Test the signed release through Play's internal track or equivalent controlled
device testing before the approved production rollout. Verify installation as
an update over 2.10.0 without uninstalling, retained sign-in and data, Android
back, keyboard, cutouts and gesture navigation, permissions, notifications,
file uploads/downloads, camera/mic/live calls, password recovery redirects,
and every role's tools. A debug APK uses a debug certificate and cannot establish
upgrade compatibility with the live app; do not uninstall the live app to force it.

Check the full workflow: Calendar uploads and sessions; Candidate Tracker edit,
search, import/export and arrivals; roster/leave/OT/TOIL; My Desk/checklists;
Shift duties/handovers; team messages/attachments/live calls; Actionables;
vault and admin tools; AI and Mission 7 where available. Backend writes and
authenticated production behavior were not validated against live records.

Review the store title, description, 512px icon, 1024×500 feature graphic, and
phone screenshots. Confirm the privacy policy, Data Safety, app access review
credentials, content rating, permissions declarations and account deletion
flow against the actual app behavior. Existing listing disclosures are not
available in this session and must not be guessed or overwritten.

Only after review: upload the signed AAB to the existing app, inspect Play's
validation and pre-launch report, and approve a staged production rollout.
No new Play application or signing identity is needed.

## Validation of this change

The production web build and Android `assembleDebug` pass. APK metadata confirms
`com.fets.staffapp`, proposed version name `7.1.0`, min API 24 and target API 36.
Debug builds retain the template version code 1; this is not a Play upload.
The full Vitest suite has 155 passing and 5 failing tests (160 total, 30 files).
All 16 new mobile/navigation tests pass. The five baseline failures are four
chat assertions in `useChat.test.tsx` and one client-mapping assertion in
`useCalendarSessions.test.tsx`; no tests were disabled.

Chromium checks cover five-tab navigation, searchable tools, route transitions,
and phone layouts at 320, 360, 393 and 767 pixels plus desktop at 1280 pixels.
The browser test intercepts authentication and backend responses with synthetic
data, and reports no JavaScript page errors. It does not test production access,
Android WebView, upgrades or actual push/camera/live calling behavior.
To reproduce and regenerate the screenshot drafts with an isolated tool install:

```sh
npm install --prefix /tmp/fets-preview-tools playwright --no-audit --no-fund
# Start pnpm --filter fets-point dev from the repository root in another terminal.
FETS_PLAYWRIGHT_MODULE=/tmp/fets-preview-tools/node_modules/playwright \
  FETS_CHROMIUM_PATH=/usr/bin/chromium \
  node scripts/android/mobile-browser-check.cjs
```

The cloud build used workspace-local SDK, JDK and Gradle caches; these are not
repository files. The existing runtime's proxy certificate was retained for
Java HTTPS verification. TLS, package integrity and distribution checksums
were not disabled. Signing credentials were absent from this cloud machine. Firebase configuration
is optional. The signed AAB, production device validation, Console
review and rollout remain pending.

The optional-Firebase correction is covered by four native initialization tests;
all 20 mobile/navigation tests pass. Both release helpers permit a missing
Firebase file, validate an explicitly supplied file, and retain signing checks.
