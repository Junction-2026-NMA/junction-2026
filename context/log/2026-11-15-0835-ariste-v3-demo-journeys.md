# v3 demo journeys: payday + Path lesson, Espoo housing project with phone notifications

**Summary:** Both v3 demo journeys work end to end in mock mode on branch `feat/v3-demo-scenarios`; phone notifications need sisu-api redeployed from this branch with VAPID keys set.
**Author:** Aristé (Claude Code) · **Branch:** feat/v3-demo-scenarios · **Lane:** frontend + agent + financial engine (owner's v3 brief, for Nicholas to review)

## Done
- Payday: "Why do I keep running out of money before payday…" → `get_cash_flow`, short answer on Today's figures and date ("Synthetic demo data · as of …"); "20 percent less eating out" → Restaurants category cut per month, 10% is exactly half, no projection or transfer; "Open the lesson: …" opens the existing Path lesson (`web/core/AnswerPayday.ts`, `AppModel.openLesson`).
- Housing: renting clarified; max rent, min size and savings collected; `search_flats` takes `minAreaM2`, `monthlySavingsEur`, `savingsGoalEur` and always drafts the project. One rule (`lib/watch/rule.ts` + `evaluate.ts`: match / needs_verification / fails, "Maximum rent" separate from "Savings goal") for answers, counts, findings and notifications.
- Transfer guard (`lib/agent/tools/act.ts`): no transfer in housing talk, and only when the latest message asks to move money.
- Projects: "Make this a project" → confirmation with every requirement and "Notify me when a match is found" → `POST /api/watch/create` (fromActionId) → first check runs on the server (`lib/watch/background.ts`, `after()`); "How Sisu found this" from stored tool results (`lib/watch/evidence.ts`).
- Notifications: Web Push (`lib/push/*`, `/api/push/{key,subscribe,unsubscribe,test}`, `public/sisu-sw.js` with no fetch handler). Alerts are saved before sending, once per finding (`lib/watch/alerts.ts`); in-app banner when push is off; a tap opens `/app?project=&finding=`.
- Demo: "Simulate a listing change in 20 s" (`simulate-drop` `delaySeconds`) goes through the real rule, finding and alert, labelled "Simulated for demo". `POST /api/demo/reset` clears only the caller's watches, findings and alerts (keeps the phone subscription).
- Checks: 505 unit tests, all web checks, tsc, eslint (0 errors), build. Playwright 402x874 mock run of both journeys, no console errors.

## Decisions
- `lib/types.ts`: additive v3 types (NotifyMode, ProjectSchedule, SchedulerInfo, EvaluatedListing, ProjectEvidence, MonitorChange, ProjectAlert, PushSubscriptionRecord, ProjectCreateRequest; optional fields on watches and findings). Affects: anyone reading watches.
- Only "Notify me when a match is found"; no daily summary or deadline (owner's cut). The app shows the real cadence from `schedulerInfo`.
- Housing video uses CUST02003: CUST04974 and CUST04414 already run short, so an honest savings check fails every listing for them.
- New dependency `web-push` 3.6.7.

## Next / open questions
- Nicholas: deploy sisu-api from this branch with `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`) and optionally `VAPID_SUBJECT`. Without `CRON_SECRET`, the only server checks while the app is closed are the first check after approval and the delayed simulation.
- Then redeploy sisu-demo and test push on the filming iPhone (app opened from the Home Screen, iOS 16.4+), locked.
- Live Exa/Context.dev and the live model were not tested (no keys on this Mac); mock mode only.
