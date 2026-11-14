# Hosting: state in Supabase, and a session for every visitor

**Summary:** The backend can now run on a hosted site for many people at once (the QR code case): each visitor gets their own approvals, memory and audit log, stored in Supabase; with no settings a laptop behaves exactly as before.
**Author:** Nicholas (Claude Code) · **Branch:** feat/hosted-per-visitor-state · **Lane:** agent

## Done
- Sessions (`lib/store/session.ts`, `lib/agent/visitor.ts`): a route wrapped in `withVisitor` runs as its visitor. The visitor comes from the `X-Sisu-Session` header, else the `sisu_session` cookie, else a new session is handed out (cookie and response header). The 23 routes that touch state are wrapped; the 8 that never do are not.
- Store (`lib/store/state.ts`, `lib/store/supabase.ts`): the same three functions as before, now per session, in a file (default) or in Supabase when `SUPABASE_URL` and a key are set. Saves name the version they were based on; when another server instance saved first, the change is replayed on top instead of overwriting it.
- Database: `deploy/supabase/sisu_sessions.sql` (one table, two functions). It is applied in a new Supabase project `sisu` (Stockholm) on Nicholas's account. The table itself is closed to the public key.
- A stream keeps its visitor and stores the state before it closes (`eventStream` in `lib/agent/http.ts`). The rate limit is per visitor, with 8 times the ceiling for the address a room shares.
- `POST /api/demo/reset` clears only the caller's state where visitors are kept apart, and needs no token there.
- A frontend on another address: `SISU_CORS_ORIGINS` and `proxy.ts` (`lib/agent/cors.ts`).
- Docs: section 16 of `docs/FRONTEND_INTEGRATION_CONTRACT.md` and the new lines in `.env.example`.
- Measured: 285 unit tests pass (21 new in `tests/unit/hosting.test.ts`), typecheck, lint and build pass. Live against the real Supabase project and Nemotron on Verda: two visitors ran the money plan separately (one approved 4 actions, the other kept 4 waiting), the state came back after a server restart, "start over" cleared one visitor only, an Ask turn answered in 0.44 s to the first sentence.

## Decisions
- No type, event or endpoint changed shape. `HealthReport.store` gained `kind` and `perVisitor`. Affects: nobody has to change code.
- Web pages served by this server and the iOS app need no change: the cookie does it. A page on another address must send the `X-Sisu-Session` header, because iPhones block cookies between sites. Affects: frontend, only if hosted apart from the backend.
- The server uses the publishable key unless `SUPABASE_SECRET_KEY` is set. With the publishable key, anyone who had the project address and that key could create rows, but could not read or change a session without its id (32 random characters). Affects: agent lane; switch to the secret key and remove `anon` from the grants to close it fully.

## Learned / gotchas
- A hosted server cannot reach the model on our GPU: it is only reachable through the SSH tunnel on a laptop. A deploy needs a `VERDA_BASE_URL` the host can reach, or `MODEL_PROVIDER=nvidia`, and NVIDIA's hosted model was unreliable on 14 Nov.
- Only one `next dev` can run in a checkout. Search results and page reads live in the server's memory, so fresh instances look them up again.
- From the venue Wi-Fi a Supabase round trip took 40 to 230 ms. Each request to a state route makes one before it starts.
- Nothing is deployed. No Vercel setting, key or domain was touched.

## Next / open questions
- Decide how the hosted server reaches the model, then deploy (needs Nicholas's OK).
- iOS: nothing to change for sessions; `basket_bar` charts and the plan screen are still open (see the 17:55 entry).
