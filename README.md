# Rs Calculator

A modern Android calculator app built with **Kotlin** and **Jetpack Compose** (Material 3).

## 📱 Download the APK

Every push builds an installable debug APK on GitHub Actions and attaches it to a rolling release:

**<https://github.com/Rusindu12/Rs/releases/download/latest-apk/Rs-Calculator.apk>**

Open that link on the phone → allow “install from unknown sources” when Android asks → done.
Full build history and other artefacts: [Actions → Build APK](https://github.com/Rusindu12/Rs/actions/workflows/apk.yml).

> The APK is signed with the Android *debug* key, so it is meant for personal testing —
> not for Play Store upload. See [Building a release APK](#building-a-release-apk).

## Features

- Full expression input — type a whole expression like `12×(4+8)−50%` and evaluate it at once
- **Live preview** of the result while you type
- Correct operator precedence, parentheses (with auto-balancing on `=`), and implicit multiplication (`2(3+4)`)
- Percent, sign toggle (`+/−`), backspace and `AC`
- **History sheet** — tap any past result to reuse it
- Material 3 with dynamic color (Android 12+), light/dark theme, edge-to-edge layout
- Adaptive launcher icon
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

app/src/test/java/...        # Unit tests for the engine and the reducer
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
(and `out/Rs-Calculator-debug.apk` by the script).

### CI: automatic APK on every push

`.github/workflows/apk.yml` runs the unit tests, builds `app-debug.apk`, uploads it as a
workflow artefact (*Rs-Calculator-debug-apk*, kept 90 days) and publishes it to the
[`latest-apk` release](https://github.com/Rusindu12/Rs/releases/tag/latest-apk) so the same
download link always points at the newest build. Trigger it manually from
**Actions → Build APK → Run workflow**.

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
