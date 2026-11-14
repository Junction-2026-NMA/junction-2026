# Instructions for agents working in `ios/` and `rive/`

This is the native Sisu app: Swift, SwiftUI for structure, Rive for every interface component. Read
[`README.md`](README.md) (layout, checks, how Rive components are used) and [`BRAND.md`](BRAND.md) (brand and
judging rules) before you write anything. The team rules in the repository's root `CLAUDE.md` still apply.

## Where things go

- **App logic: `ios/SisuCore`.** A pure Swift package with no dependencies. The public declarations and their
  doc comments are a contract: build the behaviour each doc comment states, and do not rename or change a
  public signature. Lines marked `// scaffold stub` are placeholders to replace.
- **Screens: `ios/Sisu`.** SwiftUI. Components come from Rive through `RiveComponentView`, with values built by
  `RiveBindings`. SwiftUI itself is for layout, scrolling, text entry, lists, sheets and charts.
- **Rive files: `rive/`** sources, built into `ios/Sisu/Resources/Rive`. The names in `rive/contract.json` are
  fixed. The Rive files are authored separately: do not edit `rive/` or `ios/Sisu/Resources/Rive` unless your
  task is the Rive library itself. Every interface asset is a 2D Rive animation in `sisu_ui.riv`; there is no
  3D file and no fallback between components.

## Testing

Testing: XCTest only (not Swift Testing), in `ios/SisuCore/Tests/SisuCoreTests/`. One `XCTestCase` class per
file, named after the file (rule in `README.md`). Run one file with
`sh ios/scripts/swift-test-file.sh <test-file> <junit-report>`, and all of them with
`sh ios/scripts/test-core.sh`. Both run from the repository root. Tests use no network and no real clock:
inject time. Bundled sample JSON is reached through `FixtureAPI` or `Bundle.module` (subdirectory `Fixtures`).

## Checks (run from the repository root)

| Command | Needed for | Notes |
|---|---|---|
| `sh ios/scripts/test-core.sh` | Any change under `ios/SisuCore` | Runs on the Mac in seconds. |
| `sh ios/scripts/build-check.sh` | Any change under `ios/Sisu` | Compiles the app for the iOS Simulator. About two minutes. Uses the Swift package cache in `~/Library/Caches/sisu-ios-packages`. |
| `sh ios/scripts/test-app.sh` | Changes to the Rive layer or the Rive files | Boots a simulator. Run it by hand, not in automated checks. |
| `sh rive/build.sh` | Changes to `rive/sisu-ui` | Rebuilds `sisu_ui.riv`. |
| `sh ios/scripts/screenshots.sh` | Changes to screens | Screenshots of every screen into `ios/.derived-app/screens/`. Look at them. |

## Do not

- Add dependencies, edit `ios/project.yml` or `ios/Sisu.xcodeproj`, or rename anything in `rive/contract.json`.
- Put logic in views, hard-code colours or sizes (use `SisuTheme`), or compute money figures in the interface.
- Show data that is not live without the "Sample data" tag, or a simulated action without
  "Simulated, no real switch".
- Use red for spending, blame the user in copy, or show Liito sad or angry.
