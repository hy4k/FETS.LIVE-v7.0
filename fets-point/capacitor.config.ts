import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // MUST be com.fets.staffapp — that is the published Play listing.
  // `fets-point/android/` is gitignored, so the corrected applicationId has
  // only ever lived in local copies of the generated wrapper. Anyone running
  // `npx cap add android` from a fresh checkout previously got com.fets.live,
  // which cannot update the listing: Play treats a different applicationId as
  // a brand new app and abandons the existing one, its installs and reviews.
  appId: 'com.fets.staffapp',
  appName: 'FETS LIVE',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
