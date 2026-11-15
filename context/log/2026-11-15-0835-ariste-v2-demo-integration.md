# v2 demo integration: Jack's payday, the Espoo housing project, background research and iPhone push

**Summary:** Branch `feat/v2-demo` holds Mark's v2 demo brief end to end (payday budget and restaurant cut, the recorded housing question → intake → results → Make this a project, server-side research and Context.dev webhooks, web push to the home-screen app); it needs Nicholas to redeploy sisu-api and Wiktor's yes to redeploy sisu-demo.
**Author:** Ariste (Claude Code, coordinator) · **Branch:** feat/v2-demo · **Lane:** all three (payday, housing, push), merged here

## Done
- Merged the three lanes (see their entries: `…0812-ariste-payday-v2`, `…0835-ariste-housing-project-v2`, `…0800-ariste-push-background-v2`) and `feat/web-port` up to `f84cd54` (beUI chat components, voice-first dock).
- Fixes at integration: an unmeasured commute no longer blocks a Best match (it stays flagged "not measured" on every listing); the housing budget sentence no longer says "plus €-12"; monitoring copy says what really runs (Context.dev every 15 minutes, reported to Sisu's server by webhook when `SISU_WEBHOOK_KEY` is set).
- Checked locally (mock model, file store, per-visitor sessions, throwaway VAPID keys): `npm test` 499/499, tsc 0, eslint 0 errors, all 11 web checks, `npm run build`. Phone-sized Chrome walkthroughs of both flows with no console errors. API: payday €286.37 (€133.64/week); payday 20 Oct + €80 bill → €136.18; 20% restaurants €55.30, "What about 10%?" €27.65 from the same €276.52 baseline; the recorded housing question → `housing_intake` (Rent, suggested rent €595); search → listings with exclusion reasons + project proposal; approve → `researching` → `initial_ready` in the background; delayed simulated change → labelled finding, `pushedAt` set, push signed and sent (Apple rejected the fake test endpoint, as expected).

## Deployed
- sisu-demo (web app + `/sw.js`) redeployed from a clean `git archive` of `6e81f80` (15 Nov ~08:45 EET, Wiktor's yes). Checked live: `/app` 200, `/sw.js` served, phone-sized payday walkthrough with no console errors. sisu-api is unchanged, so live answers are still the old backend's ("Estimated weekly budget", `/api/push/key` 404) until Nicholas redeploys.

## Redeploy steps for Nicholas (sisu-api)
1. Deploy `feat/v2-demo` (or merge it into main first).
2. Env on sisu-api: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (`npx web-push generate-vapid-keys`), `SISU_WEBHOOK_KEY` (`openssl rand -hex 32`), `SISU_PUBLIC_API_ORIGIN=https://sisu-api.vercel.app`. Optional `VAPID_SUBJECT` (default `https://sisu-demo.vercel.app`). No new SQL.
3. Deployment Protection must let Context.dev reach `POST /api/watch/webhook`.
4. sisu-demo already runs this branch (it serves `/sw.js`; `/api` still forwards to sisu-api).

## Filming checklist (iPhone, iOS 16.4+, after both deploys)
1. Safari → sisu-demo.vercel.app/app → Share → Add to Home Screen → open Sisu from the Home Screen.
2. Settings → Notifications → Turn on notifications → Allow. "Send a test notification" must arrive.
3. Payday: ask the recorded payday question; check €286.37 until Thu 15 Oct and "Show the maths"; "What if I spent 20% less at restaurants?" (€55.30) then "What about 10%?" (€27.65); tap the lesson button.
4. Housing: ask the recorded Espoo question → intake card (Rent; size, commute, move date, savings goal; Sisu's suggested rent) → Search → results → Make this a project → Approve. Lock the phone: "first results are ready" arrives; tap → the project.
5. On the project: Simulate a listing change (demo), lock within 30 s; "Your Espoo housing search has an update." arrives; tap → the project, finding labelled Simulated update. Pause, repeat: nothing arrives.

## Learned / gotchas
- A test client must send a valid session id (16–64 of `[A-Za-z0-9_-]`) in `X-Sisu-Session`, or every call gets a new session.
- Turbopack refuses a symlinked `node_modules` in a worktree; clone it with `cp -Rc`.
- Playwright's cached Chromium doesn't match the npx Playwright version here; `channel: "chrome"` works.

## Next / open questions
- Not tried on a real iPhone, nor with live Exa/Context.dev (everything ran on mock research), nor with real Context.dev webhooks (`data.change.monitor_id` is assumed).
- A simulated drop can look implausible (mock: €1,180 → €575); it is labelled simulated everywhere.
- On mock data the "Background research" card says Context.dev checks every 15 minutes while the Checks card says nothing is watched on the web; live both say Context.dev.
