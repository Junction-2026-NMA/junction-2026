# Background research and phone push notifications for projects (v2 push)

**Summary:** Approving a project now answers at once and the research goes on on the server (after()); Context.dev monitors run every 15 min and call a signed webhook; new findings, first results and the demo change are pushed to the phone (web-push, service worker `public/sw.js`), and a tap opens the right project.
**Author:** ariste (Claude Code) · **Branch:** worktree-agent-a6bd1102620f5086b (from feat/web-port) · **Lane:** agent + frontend

## Done
- Background start: approve routes store the watch in phase `researching` and run `finishStart` (`lib/watch/start.ts`) with `after()` (`lib/background.ts`, runs in the visitor's session: openSession/inSession/settleSession). It creates the monitors (15-min schedule + webhook), re-reads pages the chat could not, sets `initial_ready` and pushes "Your Espoo housing search: first results are ready." Later checks set `monitoring`. A pause/stop during setup wins and the new monitors are deleted. A start whose job died is finished by the next check (after 2 min).
- Webhook `POST /api/watch/webhook?ref=` (`lib/watch/webhook.ts`, `lib/watch/receive.ts`): ref = AES-256-GCM {session, customer, watch}; HMAC signature on the raw body (5-min tolerance); dedupe on X-Context-Id (`state.webhookDeliveries`); paused/stopped -> 200 ignored; else 202 and `checkWatches(trigger "webhook")` after the answer. Change title/summary kept as `WatchedPage.lastChange`.
- Push: `lib/push/*`, `GET /api/push/key`, `POST|DELETE|GET /api/push/subscribe`, `POST /api/push/test`. One push per check batch per project; `WatchNotification.pushedAt` claimed before sending; 404/410 drops the subscription. Cron and webhook checks push; app-open checks do not.
- Status fields on `PropertyWatch` (lib/types.ts "v2 push"): `phase`, `initialReadyAt`, `nextReviewAt`, `failedChecks`, `lastFailure`, `retryAt`, `webhooks`. Retry backoff 1/5/15 min (runMonitorNow when due). Secrets stripped in `asProject` (stop route too).
- Demo: `POST /api/watch/:id/simulate-drop { customerId, delaySeconds: 1..50 }` -> 202, waits on the server, records a finding labelled simulated, pushes. Also `GET /api/watch/demo-drop?delay=30`. Button "Simulate a listing change (demo)" on the project.
- Web: `public/sw.js` (no fetch handler), `web/app/Push.ts`, `web/features/Projects/PushControls.tsx`, `ProjectMonitoringStatus.tsx` (+ css), Settings > Notifications, `useProjectLaunch` handles the SW message; `web/core/WatchMonitoring.ts` decodes the new fields. Tests: `tests/unit/push.test.ts`.

## Backend env (sisu-api, Nicholas deploys)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`: run `npx web-push generate-vapid-keys` once, paste both into Vercel env (never in git).
- `VAPID_SUBJECT` optional (default `https://sisu-demo.vercel.app`; Apple rejects odd subjects).
- `SISU_WEBHOOK_KEY`: any long random string (`openssl rand -hex 32`). Without it: no webhooks, polling only.
- `SISU_PUBLIC_API_ORIGIN=https://sisu-api.vercel.app` (else VERCEL_PROJECT_PRODUCTION_URL is used). Deployment Protection must not block `/api/watch/webhook`.
- Existing: `CONTEXT_DEV_API_KEY`, Supabase vars, `CRON_SECRET`. No new SQL. sisu-demo needs nothing new (it serves `/sw.js` and forwards `/api`).

## Test on the filming phone (iPhone, iOS 16.4+)
1. Open sisu-demo in Safari, Share > Add to Home Screen, open Sisu from the Home Screen.
2. Settings > Notifications: "Turn on notifications", allow. Status says Enabled. "Send a test notification": it arrives.
3. Ask Sisu for flats in Espoo under a budget, approve the watch. Project shows "Researching…", lock the phone. A push "first results are ready" arrives; tap it: the project opens.
4. On the project, "Simulate a listing change (demo)", lock the phone within 30 s. Push "Your Espoo housing search has an update." Tap: the project opens with the finding labelled simulated.
5. Tap "Simulate a listing change (demo)" again, then Pause within 30 s: nothing arrives, and no check runs while paused (monitors deleted, webhooks ignored).

## Open
- Not tested on a real iPhone or against live Context.dev webhooks (payload field `data.change.monitor_id` is assumed; any of the watch's secrets is accepted, so a different field name only loses `lastChange`).
- `record()` still replaces the watch with the snapshot it read; concurrent checks on two instances could overwrite page readings (findings are deduped in the reducer now).
- 15-min monitors cost more Context.dev credits than 6 h ones; one `run.completed` webhook per page per run triggers one check.
