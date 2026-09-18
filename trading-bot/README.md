# 🤖 AI Trading Bot

React Native (Expo) app — same codebase ships as an **Android APK** and a **static web app**.

```
npm install
npm run typecheck && npm test      # 65 engine tests
npx expo prebuild -p android --no-install
cd android && ./gradlew assembleRelease   # → app/build/outputs/apk/release/app-release.apk
npx expo export --platform web            # → dist/ (host anywhere)
```

- **Release APKs bundle the JS.** Debug APKs skip JS bundling by design and boot to
  “Unable to load script” without Metro — always ship `assembleRelease` for installs
  (the RN template signs release builds with `android/app/debug.keystore`).
- **Web build** is an SPA (`expo export --platform web`, `output: "single"` in app.json).
  Metro emits absolute asset paths; CI rewrites them relative so the site works under any
  sub-path (GitHub Pages, Netlify drop, …). Published to the `web-app` branch on every
  release run.
- Platform guards: biometrics and `keychainAccessible` are native-only (`Platform.OS` checks
  in `LockScreen` / `SettingsScreen` / `secureVault`); everything else — indicators, signal
  engine, REST/WS clients, stores — is shared TypeScript.

See the repository root README for the full feature list and download links.
