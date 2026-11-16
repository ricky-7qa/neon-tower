# Neon Tower — Android & iOS app setup

The website remains the source of truth. Capacitor packages the existing HTML, CSS and JavaScript into native Android and iOS projects.

## Requirements

- Node.js 22 or newer
- Android: Android Studio and Android SDK
- iOS: a Mac with Xcode
- The native Android and iOS project folders are generated locally and should be committed to the repository after they are created.

## First-time setup

```bash
npm install
npm run cap:add:android
npm run cap:add:ios
```

Run the iOS command on a Mac with Xcode installed. Android and iOS project creation can be done on separate computers if needed.

## Build and open

Android:

```bash
npm run cap:open:android
```

iOS:

```bash
npm run cap:open:ios
```

These commands copy the current web game into `www/`, sync Capacitor, and open the native project.

## Important notes

- The original GitHub Pages website continues to use the root `index.html`; the native build uses the generated `www/` folder.
- Supabase authentication, cloud saves and leaderboard still require an internet connection.
- Local game progress remains stored on the device. Test save persistence, login, leaderboard, app backgrounding/resume, audio, and screen sizing on real devices before release.
- Do not publish until both platform builds have been tested and the store listing, privacy disclosures, age rating, app icon, and screenshots are ready.
