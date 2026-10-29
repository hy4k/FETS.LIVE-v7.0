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

Android implements **Kayal Relief**: ivory `#F1ECE3` and obsidian `#08282C`
grounds, lagoon `#0D4A50` and champagne `#E9C779` pigments, superelliptical
corners, and a single consistent light source. Both light and dark schemes are
defined, and every colour pairing is held at WCAG AA by `ContrastTest`.

Note that the two schemes are not inversions of each other — they swap which
pigment carries meaning. Champagne is 1.38:1 on ivory and 9.56:1 on obsidian, so
it is decoration in light and speech in dark; lagoon does the reverse. For that
reason champagne is deliberately not a `ColorScheme` role at all: it lives in
`KayalAccent`, where it cannot be assigned as a text colour.

iOS still carries the older "golden theme" (`#1A3A3D` / `#FACC15`) and has not
been migrated.

## Android build

Prereqs: Android Studio (JDK 17+), Android SDK 36.

```bash
cd apps/android
./gradlew :app:assembleDebug     # debug APK (applicationId com.fets.staffapp.debug)
./gradlew :app:assembleRelease   # release AAB/APK — unsigned, sign via Play Console or your keystore
```

The debug build has `applicationIdSuffix ".debug"` so it can sit next to the
production app. Verified: compiles, installs, launches; login screen renders;
form entry and IME verified on an emulator.

### Play Store release checklist

> **The published listing is `com.fets.staffapp`.**
> Until 30 Oct 2026 this module declared `com.fets.live`, and this README stated
> that the package matched the existing listing. It did not. A build under a
> different applicationId cannot update the listing — Play would have treated it
> as a brand new app, abandoning the existing one along with its install base,
> its reviews and its release history. `ReleaseIdentityTest` now holds this.

1. **applicationId** — must be exactly `com.fets.staffapp`. Never `com.fets.live`.
2. **versionCode** — must exceed the currently published value, which was **34**
   as of 30 Oct 2026. This module is at 35. Check the current value in Play
   Console before uploading rather than trusting this number.
3. **Signing** — use the existing upload key. The keystore stays on the owner's
   machine and its credentials are read from a gitignored `keystore.properties`;
   no credentials belong in this repo.
4. **Store assets** — the current listing's graphics carry over because the
   package ID is unchanged; update screenshots to match the new UI.
5. Run `./gradlew :app:testDebugUnitTest` before building a release.
6. Pre-launch report will flag anything the emulator checks miss.

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
