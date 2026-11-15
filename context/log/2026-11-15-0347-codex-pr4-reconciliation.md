# PR4 reconciled with merged backend fixes

**Summary:** Reconciled QA fixes with PR17/current main, preserving client files and stored-state approval checks.
**Author:** Codex · **Branch:** qa/independent-judge-audit · **Lane:** agent

## Done
- Integrated main 032dae4 (PR17 already merged). Resolved watch conflict preserving stop/reset protection and current generic price-watch wording.
- Adapted competing-switch guard to PR17 decideOn: inspect supplied state during hosted conflict replay and return a Decision. Added cross-instance competing-switch regression.
- Includes existing PR4 required-Request route signature and health test fix; no separate update to merged PR17 needed.
- 385/385 unit tests, lint and webpack production build pass. Mock HTTP audit: 12 concurrent turns, cross-customer 404, missing confirmation 400, approval race 200/409/409.
- 390x844 production Playwright smoke: Aino plan -> approve four -> four explicit simulated completions and futures. Zero console messages; screenshot inspected.

## Decisions
- Final diff versus main: no app/components/hooks/ios, client hooks, shared types, package or config changes. API shapes retained; backend correctness/validation changes are intentional.
- Existing webpack utility styling limitation persists; smoke is functional, mock-only. No live-provider or native runtime claim. Prescribed e2e smoke file/runner absent; used Playwright MCP.

## Next / open questions
- Nicholas authorized reconciliation and merge of PR4. No deployment authorized or performed.
