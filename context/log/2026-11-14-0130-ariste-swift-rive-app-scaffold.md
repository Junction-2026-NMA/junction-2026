# Frontend moves to a native Swift + Rive app; scaffold is in `ios/` and `rive/`

**Summary:** The frontend lane now builds a native iOS app (SwiftUI, every component drawn by Rive) that is a client of the same API contract; the web page in `app/` stays as it is.
**Author:** Ariste (Claude Code) · **Branch:** feature/frontend · **Lane:** frontend

## Done
- `ios/SisuCore`: Swift package with no dependencies. Models mirror `lib/types.ts`; the demo flow, formatting, offer maths and a sample coach backend are declared as documented stubs. Bundled sample JSON was captured from the live routes on 14 Nov.
- `ios/Sisu` + `ios/Sisu.xcodeproj` (XcodeGen): app shell, `SisuTheme`, and `RiveComponentView`, which binds SwiftUI state to Rive view models. Builds for the simulator; hosted tests pass.
- `rive/sisu-ui` → `ios/Sisu/Resources/Rive/sisu_ui.riv`: 17 Rive components written as text (RML) and built with the Rive CLI. `rive/contract.json` fixes their names and properties.
- How to work in it: `ios/README.md`, `ios/AGENTS.md`, `ios/BRAND.md`, `rive/README.md`.

## Decisions
- Team agreed: the Swift app replaces the web page as the demo frontend. Affects: lane A deliverables in `context/build-plan.md`, which still describes the web frontend and needs updating on `main`.
- The frontend lane now also owns `ios/` and `rive/`. No change to `lib/types.ts`, `package.json` or config.
- The agent, research, action and reset endpoints have provisional Swift types in `ios/SisuCore/Sources/SisuCore/Coach.swift`. Affects: lanes B and C; when the real types land in `lib/types.ts` the Swift copy follows them.

## Learned / gotchas
- The simulator reaches the backend at `http://localhost:3000`; a phone on the booth network needs the Mac's address or the Vercel URL.
- Rive files with scripts (Rive's 3D) only run when signed with `rive --publish`; on the free plan that adds a Rive splash screen. The 2D library has no scripts and needs no account.
- Anything the app shows that is not live is labelled "Sample data".

## Next / open questions
- Build the full demo flow in the app (customer, X-ray, ask, research, teach, approve, impact).
- B and C: please post the response shapes for `/api/agent/query`, `/api/research`, `/api/actions/*` and `/api/demo/reset` as soon as they exist.
