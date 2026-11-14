# Sisu can say what its watches found

**Summary:** Asked "did my watch find anything?", Sisu used to answer that it had no tool to check. It now knows its running watches and their findings, and answers with the figures.
**Author:** Nicholas (Claude Code) · **Branch:** fix/sisu-knows-its-watches · **Lane:** agent

## Done
- `lib/agent/prompt.ts`: a `WATCHES THE CUSTOMER APPROVED` block with each running watch (what, the limit, pages, when last checked) and the newest findings, word for word.
- `lib/agent/orchestrator.ts`: the figures in a finding and each watch's limit are receipts; the finding's text counts as context.
- Tests: `tests/unit/watch-status.test.ts` (3). 348 unit tests pass; typecheck, lint, build pass.
- Live with Nemotron on our GPU: before a finding, "nothing has come under your limit yet"; after a simulated drop, "Tanhuantie 1 F 76 in Kontula is now 675 euros a month, down from 930, 25 euros under your 700 euro limit ... simulated for the demo". The same in Finnish. No tool call, about 1 s.

## Decisions
- No tool was added: answering needs no search. Nothing in the watch code changed. Affects: nobody has to change code.

## Learned / gotchas
- "Find me a one-room flat in Helsinki under 600" finds flats that fit, so there is no "nothing fits" moment. For the demo use a search where nothing fits (three rooms under 700, or an iPhone 15 under 450).
