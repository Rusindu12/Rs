# Rs Calculator

A modern Android calculator app built with **Kotlin** and **Jetpack Compose** (Material 3).

## 📱 Download the APK

**APK එක අවශ්‍යද? — පියවර 2ක්.** (1) පහල one-time activation එක කරන්න, (2) ඊට පස්සේ හැම
push එකකම `Rs-Calculator.apk` මේ link එකෙන් එනවා — phone එකෙන්ම open කරලා install කරන්න පුළුවන්.

```
https://github.com/Rusindu12/Rs/releases/download/latest-apk/Rs-Calculator.apk
```

GitHub Actions has never run in this repository, so the pipeline has to be switched on **once**
(workflow files must land on `main`, and only the repo owner can do that):

| | What to do | Time |
|---|---|---|
| 1 | **Merge the open PR that adds [`.github/workflows/apk.yml`](https://github.com/Rusindu12/Rs/blob/main/.github/workflows/apk.yml)** — or, PR-free, [create that file in the browser](https://github.com/Rusindu12/Rs/new/main?filename=.github/workflows/apk.yml) and paste in [`ci/apk.yml`](https://github.com/Rusindu12/Rs/blob/main/ci/apk.yml) | ~30 s |
| 2 | If GitHub shows the “Workflows aren’t being run on this repository” banner: **Actions** tab → **I understand my workflows, go ahead and enable them** → **Settings → Actions → General** → *Workflow permissions* = **Read and write permissions** (needed to publish the release) | ~20 s |

The merge itself starts the first build (≈ 4–6 min of Gradle warm-up). When that run goes green the
link above works, the job summary prints a **QR code** for the phone, and every later push rebuilds
automatically. If you would rather not wait for CI: [build it locally](#build--run).

Open the link on the phone → allow “install from unknown sources” when Android asks → done.
Full build history and per-run artefacts: [Actions → Build APK](https://github.com/Rusindu12/Rs/actions/workflows/apk.yml).

> The APK is signed with the Android *debug* key, so it is meant for personal testing —
> not for Play Store upload. See [Building a release APK](#building-a-release-apk).

## Features

- Full expression input — type a whole expression like `12×(4+8)−50%` and evaluate it at once
- **Live preview** of the result while you type
- Correct operator precedence, parentheses (with auto-balancing on `=`), and implicit multiplication (`2(3+4)`)
- Percent, sign toggle (`+/−`), backspace and `AC`
- **History sheet** — tap any past result to reuse it
- Material 3 with dynamic color (Android 12+), light/dark theme, edge-to-edge layout
- Adaptive launcher icon (Android 8+), plus generated PNG fallbacks for older launchers
- Pure-Kotlin, Android-free calculation core covered by unit tests

## Project structure

```
app/src/main/java/com/rusindu/calculator/
├── MainActivity.kt          # Compose entry point
├── CalculatorScreen.kt      # UI: display, keypad, history sheet
├── CalculatorViewModel.kt   # StateFlow-backed state holder
├── CalculatorState.kt       # State, actions and the pure reducer
├── CalculatorEngine.kt      # Recursive-descent expression parser + formatting
└── ui/theme/                # Material 3 theme and typography

app/src/main/res/
├── drawable/ic_launcher_foreground.xml   # adaptive-icon foreground (vector)
├── mipmap-anydpi-v26/                    # adaptive + monochrome icon (API 26+)
├── mipmap-{m,h,x,xx,xxx}dpi/ic_launcher{,_round}.png   # legacy bitmaps
└── values[-night]/                       # light/dark window background + strings

app/src/test/java/...        # Unit tests for the engine and the reducer
ci/apk.yml                   # the workflow (also the reviewed copy of .github/workflows/apk.yml)
scripts/build-apk.sh         # local build helper (tests → APK → out/)
scripts/gen-icons.py         # regenerates the mipmap-*/ launcher PNGs
```

Regenerate the launcher bitmaps after changing the artwork:

```bash
python3 -m pip install pillow && python3 scripts/gen-icons.py
```

The architecture is a simple unidirectional data flow:

```
UI  ──CalculatorAction──▶  ViewModel  ──▶  CalculatorReducer (pure)
 ▲                                                  │
 └──────────────  CalculatorState  ◀────────────────┘
```

Because `CalculatorEngine` and `CalculatorReducer` have no Android dependencies, all
behaviour is testable with plain JVM unit tests.

## Requirements

- Android Studio Ladybug (or newer)
- JDK 17
- Android SDK 34 (`minSdk` 24, `targetSdk` 34)

## Build & run

Open the project folder in Android Studio and press **Run**, or from the command line:

```bash
./gradlew assembleDebug        # build a debug APK
./gradlew installDebug         # build + install on a connected device/emulator
./gradlew test                 # run the unit tests
```

or let the helper script do it (runs the tests, builds, copies the APK to `out/`):

```bash
./scripts/build-apk.sh            # add --install to adb-install it on a connected phone
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`
(and `out/Rs-Calculator-debug.apk` by the script). Install that file straight onto a phone with
`./scripts/build-apk.sh --install`, or copy it over and open it.

### CI: automatic APK on every push

`.github/workflows/apk.yml` is the definition GitHub runs; [`ci/apk.yml`](ci/apk.yml) is the
reviewed copy that lives in the project folder, and a CI step fails the build if the two drift
apart (`cp ci/apk.yml .github/workflows/apk.yml` after editing). Every run:

1. `testDebugUnitTest` — the engine and reducer tests,
2. `assembleDebug` — the installable APK,
3. uploads **`Rs-Calculator-debug-apk`** as a workflow artefact (90 days, every branch and PR),
4. on the default branch only, replaces the asset on the rolling
   [`latest-apk` release](https://github.com/Rusindu12/Rs/releases/tag/latest-apk) so
   `…/releases/download/latest-apk/Rs-Calculator.apk` always points at the newest build,
5. prints a QR code in the job summary for phone installs.

If the release step cannot write (read-only workflow token), the run still succeeds and says so in a
warning — grab the artefact instead.

**Need an APK right now, from any branch?** Run
[Actions → Build APK → Run workflow](https://github.com/Rusindu12/Rs/actions/workflows/apk.yml)
on that branch: both checkboxes are on by default, so you get the `latest-apk` link *and* a
`apk/Rs-Calculator-debug.apk` file on the throwaway `apk-drop` branch — handy for environments that
can only speak git (release assets and artefacts are served from a different host, which some CI
sandboxes block). Clean up afterwards with `git push origin --delete apk-drop`. To activate the pipeline from a terminal on your own machine:

```bash
./ci/enable-workflow.sh --push   # copies ci/apk.yml into .github/workflows/, commits and pushes
```

### Building a release APK

Debug builds are fine for testing, but a release build is smaller and faster.
Create a keystore once, then point `keystore.properties` at it:

```bash
keytool -genkeypair -v -keystore rs-release.jks -alias rs -keyalg RSA -keysize 2048 -validity 10000
```

```properties
# keystore.properties  (do not commit — *.jks / *.keystore are already ignored)
storeFile=../rs-release.jks
storePassword=…
keyAlias=rs
keyPassword=…
```

Add this to `android { }` in `app/build.gradle.kts`, then run `./gradlew assembleRelease`:

```kotlin
signingConfigs {
    create("release") {
        val p = java.util.Properties().apply {
            rootProject.file("keystore.properties").inputStream().use { load(it) }
        }
        storeFile = rootProject.file(p.getProperty("storeFile"))
        storePassword = p.getProperty("storePassword")
        keyAlias = p.getProperty("keyAlias")
        keyPassword = p.getProperty("keyPassword")
    }
}
buildTypes {
    release {
        isMinifyEnabled = true
        isShrinkResources = true
        signingConfig = signingConfigs.getByName("release")
    }
}
```

## Supported expression syntax

| Input | Meaning |
|-------|---------|
| `+ − × ÷` | basic arithmetic |
| `( )` | grouping; unclosed brackets are auto-closed when you press `=` |
| `%` | divides the preceding value by 100 (`200×10%` = `20`) |
| `+/−` | negates the number currently being typed |
| `2(3+4)` | implicit multiplication |

Errors such as division by zero or a malformed expression are shown in red under the
input instead of crashing or producing `NaN`.
