# Independent web and watch delta QA

**Summary:** New web approval/customer-switch race handed off; main watch-status and demo-link regressions pass.
**Author:** Codex · **Branch:** qa/independent-judge-audit · **Lane:** agent

## Done
- Reviewed main 979e395 (PR18/19), PR17 b07b597, and web ed3af04: transport/stream reconciliation, customer/session state, approval, source and mock labels, Talk, teaching and native Rive delta. Other tracked native/landing/backend heads unchanged.
- P2: web CoachStore.decide applies an old session's approval completion to the current store; answerActions then rewards/celebrates on the shared model. Deferred-promise repro: newCustomerSession=true, cheeringFromOldApproval=true. Guard post-await state and rewards by session/customer identity. Handoff: https://github.com/Junction-2026-NMA/junction-2026/pull/17#issuecomment-6885163593
- 65 targeted backend tests pass on web branch containing PR17; web core 13/13 and 478/478, conversation 166/166. Main watch-status/demo-link tests 5/5, scripted only.
- 390x844 web smoke blocked at Sisu is loading (HMR websocket errors, dev-font 403). Screenshot inspected: browser-screenshot-127-0-0-1-mwgz632x-9c20394d.png. Production webpack compilation passes but route typecheck fails on existing optional Request issue (fix in PR4); no interactive flow sign-off.
- Native Rive enums/tests reviewed; swift test still fails no such module XCTest. No native runtime or fresh live sponsor/audio evidence.

## Decisions
- No UI/config or implementation edits; do not overlap active PR17/web lane. No merge/deploy. Challenge text re-read; existing sponsor alignment guidance unchanged.
- Available relevant thread read; no current web builder thread visible in this project's inventory. This is a snapshot only.

## Next / open questions
- Apply session guard in frontend lane and integrate existing PR4 route fix; rerun mobile flow on resulting build. Private state tracks web and native delta separately.
