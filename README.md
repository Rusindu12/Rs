# Rs Calculator

A modern Android calculator app built with **Kotlin** and **Jetpack Compose** (Material 3).

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

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`.

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
