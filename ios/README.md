# Sisu for iOS

A native SwiftUI app whose interface is drawn by Rive. iPhone, portrait, iOS 17 or newer.

## Layout

| Path | What it is |
|---|---|
| `project.yml` | The XcodeGen spec. `Sisu.xcodeproj` is generated from it and committed. |
| `Sisu/App` | The app entry, the app model (`AppModel`, with the hooks other screens use) and the root view. |
| `Sisu/Features` | The screens: Picker, Main (tab bar), Today, Ask, Jars, Path, and the sheets. |
| `Sisu/Shared` | Building blocks the screens share: card, section title, Rive property sets, accessibility. |
| `Sisu/Rive` | The Rive layer: `RiveComponentView`, `RiveLibrary`, `RiveComponentContract`. |
| `Sisu/Theme` | `SisuTheme`: colours, fonts, spacing and radii from `BRAND.md`. |
| `Sisu/Resources` | `Fonts/` and `Rive/sisu_ui.riv` (every interface component, all 2D). |
| `SisuCore/` | A Swift package with all app logic, the API models and the sample data. No dependencies. |
| `SisuTests/` | Tests that need the app, the simulator or the Rive runtime. |
| `SisuUITests/` | The screenshot harness (scheme `SisuScreens`), run by `scripts/screenshots.sh`. |
| `scripts/` | The check commands below. |
| `BRAND.md` | Colour, type, layout and voice rules. |

## Run it

1. Open `ios/Sisu.xcodeproj` in Xcode 26. The first time, Xcode fetches the Rive runtime.
2. Choose the `Sisu` scheme and an iPhone simulator, then Run.

The simulator reaches the team backend at `http://localhost:3000` (`npm run dev` in the repository root).
A component whose Rive file or artboard is missing shows as a pale-mint block with the component's name.
The app is light-only for now, because `sisu_ui.riv` has no dark variant (`UIUserInterfaceStyle` in `project.yml`).

## Check it

Run these from the repository root.

| Command | What it checks |
|---|---|
| `sh ios/scripts/build-check.sh` | The app compiles for the iOS Simulator. |
| `sh ios/scripts/test-core.sh` | Every SisuCore test passes. Runs on the Mac, no simulator. |
| `sh ios/scripts/test-app.sh` | The hosted tests pass on the "iPhone 17 Pro" simulator. Prints the Rive contract report. |

The Rive contract test loads `sisu_ui.riv` and checks every artboard against `rive/contract.json`: the
artboard, its state machine `Main`, its view model `<Artboard>VM`, every property and its type, and that each
`in` property accepts a value. It is skipped, not failed, while `sisu_ui.riv` does not exist. `test-app.sh`
also proves that the simulator ran the build it has just made (Xcode sometimes reuses an older install) and
runs once more if it did not.

`sh ios/scripts/swift-test-file.sh <test-file> <junit-report>` runs one SisuCore test file and writes a JUnit
report. The test class must be named after the file: drop `.swift`, then turn every character that is not a
letter, a digit or `_` into `_` (`money-format.hidden.swift` holds `class money_format_hidden`). Inside a
sandbox that closes the user's temporary folder SwiftPM cannot build, so the script then compiles with
`swiftc` and runs `xctest` itself (`swift-test-direct.sh`). Keep that script in step with `SisuCore/Package.swift`.

## Rive components

Screens use one view for every artboard in `rive/contract.json`:

```swift
RiveComponentView(.heroNumber, values: RiveBindings.heroNumber(hero))

RiveComponentView(.button, values: RiveBindings.button(label: "Continue")) { trigger in
    // trigger is "pressed"
}

RiveComponentView(.jar, values: RiveBindings.jar(fill: 0.4, label: "Buffer"),
                  triggers: ["celebrate#\(celebrations)"])
    .frame(height: 200)
```

- **Values** are the artboard's `in` properties by name: `.string`, `.number`, `.bool` or `.enumCase`. They
  are written when the artboard appears and whenever one changes. A property you leave out keeps the Rive
  file's own sample text, so set them all. `RiveBindings` in SisuCore builds complete sets.
- **Triggers** are requests to fire an `in` trigger: its name, or `name#stamp`. The array a view starts with
  fires nothing. After that, every entry that was not in the previous array fires once. To fire the same
  trigger again, change its stamp: `"celebrate#\(celebrations)"` fires each time `celebrations` changes.
- **`onTrigger`** is called on the main actor with the name of each `out` trigger the artboard fires
  (`pressed`, `tap0`, `toggled`, `done`, …). Add `.listening(to: ["name"])` for one the contract does not list.
- **Placeholder.** A component whose artboard cannot be loaded is drawn as a pale-mint block with its name.
  A placeholder for a component with exactly one `out` trigger fires it when
  tapped, so a flow can be built before its artboard exists.
- **Size** comes from the contract: `fixed` is exactly the design size, `flexibleWidth` fills the width at
  the design height, `contain` fits the frame you give it and keeps its proportions, `fill` fills the frame.
  A `fixed` component keeps its size inside a `.frame`; write `.sizing(.contain).frame(...)` to scale it.

`RiveFile` exists in both SisuCore and RiveRuntime. In a file that imports both, write `SisuCore.RiveFile`.
The same goes for `Color`, `Font` and `Image` in a file that imports SwiftUI and RiveRuntime; only the
files in `Sisu/Rive` should need RiveRuntime.

Each component's file, size, sizing and `out` triggers come from SisuCore's `RiveComponent`
(`Sisu/Rive/RiveComponentContract.swift` reads them). `RiveContractTests` in SisuCore and in `SisuTests` check
them against `rive/contract.json`. All interface assets are 2D: there is no 3D file.

## Screenshots

`sh ios/scripts/screenshots.sh` (from the repository root) builds into `ios/.derived-app`, runs the harness in
`SisuUITests/ScreenshotTests.swift` on the "iPhone 17 Pro" simulator and writes `ios/.derived-app/screens/<name>.png`.
Each shot is a fresh launch set up by launch arguments (`-sisu.sample 1`, `-sisu.customer <id>`,
`-sisu.tab today|ask|jars|path`, and for screenshots `-sisu.scroll`, `-sisu.sheet`, `-sisu.answer`); the
`testTaps`, `testRenameBill` and `testToggle` tests make real taps on the Rive components.

## Rules

- **App logic goes in SisuCore**, and is tested there with XCTest (`SisuCore/Tests/SisuCoreTests`). Views
  only show state and pass on taps. Every number on screen comes from the API or from SisuCore.
- **Style with `SisuTheme` only**: `SisuTheme.Color.green900`, `SisuTheme.Font.hero`, `SisuTheme.Spacing.margin`.
- **New files need no project change.** `Sisu/` and `SisuTests/` are synced folders: add a Swift file, a font
  or a `.riv` and Xcode picks it up. Regenerate only after editing `project.yml`: `cd ios && xcodegen`.
  A new font also needs a line under `UIAppFonts` in `project.yml`.
