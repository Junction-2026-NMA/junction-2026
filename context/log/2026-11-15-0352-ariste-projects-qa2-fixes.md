# Projects QA round 2: no sample switch on one dropped call, homes that fit now, a real requirements editor

**Summary:** once the server has answered, a dropped request or timeout is an error for its caller, never a switch to the bundled sample; the project view now shows `currentMatches`, edits every PATCH field and never probes routes.
**Author:** Ariste (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend (web/features/Projects, web/app/ProjectStore.ts, web/core watch client, web/core/Transport.ts)

## Done
- `web/core/Transport.ts` FallbackTransport: falls back only if the server never answered; agent turns go through `direct`, which also counts as answered.
- `GET /api/watch/:id?customerId=` in the client (`watchProject`, `web/core/WatchProject.ts`); `ProjectStore.open(id)` reads it on open and after each check or change; "Fits now" card with the housing effect, Open listing and the viewing enquiry.
- Routes are read from the list (`scheduler`, `projectStatus`, `web/app/ProjectRules.ts`), so no 404/405 probes in the console.
- Requirements editor (`web/features/Projects/RequirementForm.ts`): every PATCH field, validated in place; PATCH sends only changed fields, null clears one. The server's refusal shows next to Save.
- Honest Check now and Stop wording, plus declined and expired proposal cards, stopped projects, the deposit shown once, a 44 px header and targets, and focus moved to the title and back to the logo.

## Learned / gotchas
- `Endpoints.encode` drops nulls, so `watchUpdate` uses `CoachEndpoints.encodeKeepingNull`.
- Checks: `web/core/__checks__/projects.check.ts`, `core-a.check.ts` (answered, then offline), `integration.check.ts`.
