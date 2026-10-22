# FETS LIVE — Native Apps

Native rebuild of the FETS LIVE staff platform for the app stores. These are
**fully native apps** (Kotlin/Jetpack Compose and Swift/SwiftUI), not web
wrappers — they talk directly to the same Supabase backend as the web platform.

- `android/` — Kotlin + Jetpack Compose, package `com.fets.live` (matches the
  existing Play Store listing, so this ships as an update to the current app).
- `ios/` — SwiftUI, bundle ID `live.fets.app`, supabase-swift via Swift Package
  Manager.

## Shared feature set (v1)

| Feature | Android | iOS | Backend |
| --- | --- | --- | --- |
| Email/password sign-in, persisted session | ✅ | ✅ | Supabase Auth |
| Home command centre (live candidate/case/staff/session counts) | ✅ | ✅ | `candidates`, `incidents`, `staff_attendance`, `calendar_sessions` |
| Centre wire (news ticker) | ✅ | ✅ | `news_ticker` |
| Cases: list, filter, open new case (9 categories) | ✅ | ✅ | `incidents` |
| Calendar: month grid + day sessions | ✅ | ✅ | `calendar_sessions` |
| Candidate register by day | ✅ | ✅ | `candidates` |
| On-duty today (check-ins) | ✅ | ✅ | `staff_attendance` |
| FETS Intelligence chat | ✅ | ✅ | `fets-ai-agent` edge function (same contract as the web app) |
| Profile, role, working-centre switcher (Global/Calicut/Cochin) | ✅ | ✅ | `profiles`, `branch_status` |

## Design

Both apps implement the platform's "golden theme": deep teal `#1A3A3D`
surfaces, gold `#FACC15` accents, warm paper `#F5F2EA` background, and a
floating rounded bottom navigation bar — matching the mobile web shell's look.

## Android build

Prereqs: Android Studio (JDK 17+), Android SDK 36.

```bash
cd apps/android
./gradlew :app:assembleDebug     # debug APK (applicationId com.fets.live.debug)
./gradlew :app:assembleRelease   # release AAB/APK — unsigned, sign via Play Console or your keystore
```

The debug build has `applicationIdSuffix ".debug"` so it can sit next to the
production app. Verified: compiles, installs, launches; login screen renders;
form entry and IME verified on an emulator.

### Play Store release checklist

1. **versionCode** — must be higher than the currently published app. Update
   `versionCode` in `apps/android/app/build.gradle.kts` before uploading.
2. **Signing** — generate an upload key (`keytool`) or use Play App Signing,
   then add a `signingConfigs` block to `app/build.gradle.kts`.
3. **Store assets** — the current listing's graphics carry over since the
   package ID is unchanged; update screenshots to match the new UI.
4. Pre-launch report will flag anything the emulator checks miss.

## iOS build

Prereqs: macOS with Xcode 15+. Open `apps/ios/FETSLive.xcodeproj`, let Swift
Package Manager resolve `supabase-swift` (needs network once), select the
FETSLive scheme, run.

> Status: authored on a Windows host — the project is **source-complete but
> not yet compiled**. First build on a Mac may surface minor Swift fixes;
> the architecture, models, and Supabase calls mirror the verified Android
> implementation.

### App Store checklist

1. Set the team in Signing & Capabilities (your Apple Developer account).
2. Bump `CURRENT_PROJECT_VERSION` / `MARKETING_VERSION` in the target settings.
3. App icon is included (`Assets.xcassets/AppIcon`); add screenshots and
   privacy nutrition labels (the app contacts Supabase — declare it).
4. Push notifications and background modes are intentionally **not** in v1;
   add APNs when the team-chat/push milestone lands.

## Backend / security notes

- Both apps use the **public anon key** embedded in the client, exactly like
  the web SPA. Row Level Security policies are the security boundary — the
  same ones already protecting the web app.
- No secrets, service-role keys, or Gemini keys ship in either app.
- The AI chat calls the same `fets-ai-agent` edge function as the web platform,
  so model keys stay server-side.
