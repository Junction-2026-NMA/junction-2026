# iOS: the app talks to the hosted backend by default, and draws the three-baskets chart

**Summary:** A fresh install now uses https://sisu-api.vercel.app with no setup; a backend on the Mac is one launch argument away. None of this was built or run in Xcode: please build once before merging.
**Author:** Nicholas (Claude Code) · **Branch:** feat/ios-hosted-backend · **Lane:** agent, touching `ios/` at Nicholas's request

## Done
- `AppModel.defaultBaseURL` is the hosted backend. `-sisu.baseURL http://localhost:3000` or Settings switches to a local one. The Settings field's placeholder follows the default.
- `basket_bar` charts decode (`Visual.Content.basketBar`) and are presented as bar groups, one per basket: the basket's own bar, then its largest categories, on one scale. It uses the `.bars` body the app already draws, so no view changed.
- `CoachEndpoints.quickTimeout` and `LiveAPI.timeout` are 10 s (were 5). A hosted server that has been idle needs a few seconds to wake up, and a timeout switches the app to its bundled sample for the rest of the visit.
- README, `LaunchOptions` and `project.yml` comments say the same.

## Decisions
- Sessions need no app code. The backend hands each device a `sisu_session` cookie and `URLSession` keeps it, so two phones never see each other's approvals. Affects: nobody.

## Learned / gotchas
- Checked without Xcode (this Mac has none): `swift build` of SisuCore passes, and a small Swift program on top of SisuCore ran `CoachClient`, `CoachSession` and `PlanSession` against live backends. Hosted site (example data): 14 of 14, including "this device keeps its state, another device starts empty". Local backend with Nemotron on our GPU: 28 of 28 (data screens, Ask typed and by voice, Approve, the money plan, approve all, every stream event known).
- NOT checked: the app target does not build here, so the three edits in `ios/Sisu` (a constant, a comment, a placeholder) and the two XCTest changes were not compiled or run. `swift test` needs Xcode.
- A native app cannot be opened from a QR code by the public without TestFlight or the App Store. A QR code can open the web version at the same address.

## Next / open questions
- iOS lane: build and run the test suites once; the plan screen (`PlanSession` is ready and passes live) is still not on a screen.
