# Housing v2: intake card, results checked in code, "Make this a project", Exa and Context.dev evidence

**Summary:** "Can I afford a larger house in Espoo…" now gets an intake card in code (no model, same for voice and mock), its Search runs `POST /api/housing/search`, and only a listing that meets every confirmed requirement (each one checked) can be the best match.
**Author:** ariste (Claude Code) · **Branch:** worktree-agent-a3bca8f77d10dee92 (from feat/web-port) · **Lane:** agent + financial engine + frontend (housing only)

## Done
- `lib/housing/`: `intent.ts` (housing question? rent/buy, city, size hints), `budget.ts` (suggested rent = housing today + left over − monthly savings goal, rounded down to €5), `intake.ts`, `turn.ts` (the intake turn, wired at the top of `runTurn`), `evaluate.ts` (every listing × requirement: pass / fail / unknown, recurring and upfront costs, month and savings effect), `search.ts` (+ `app/api/housing/search`, `app/api/housing/budget`).
- Types: `// v2 housing` block in `lib/types.ts` plus optional fields: `WatchRequirements.minAreaM2`, `.savingsGoalEurPerMonth`; `WatchPlan`/`PropertyWatch` `.conversation`, `.research`; `WatchProject.evaluation`; `StageKind`/`Stage.data` gain `housing_intake`, `housing_results`.
- `fits()` (lib/watch/detect.ts) also excludes a rent that leaves the month short or below the monthly savings goal, for projects that have `savingsGoalEurPerMonth` (every intake project). `checkRequirements` knows `minAreaM2`.
- `simulatePriceDrop` (lib/watch/index.ts, only that function) now picks a listing that would meet every requirement at the dropped price, so it no longer answers 409 on a v2 project.
- `search_flats` no longer calls a flat under budget that fails another requirement "nearest above budget".
- Web: `web/core/HousingModels.ts`, `CoachSession.housingSearch/housingBudget`, `web/features/Ask/HousingIntakeCard.tsx`, `HousingResultsCard.tsx`, `HousingParts.tsx`, `housing.css` (mounted from AssistantAnswer, nothing in Talk changed); WatchActionCard says "Make this a project" for intake proposals; ProjectScreen has "From your conversation" (Open conversation), best match now, and closed sections incl. Context.dev monitoring and Exa research (query as sent, sources, listing × requirement table). Placeholder `{/* v2: monitoring status */}` left near the top for the push lane. Requirement editor has size and monthly savings fields.
- Tests: `tests/unit/housing.test.ts` (7).

## Decisions
- Unknown is not a pass: a listing with an unknown required fact (size, move date, and always the commute, which Sisu cannot measure) is "Needs checking", shown as "Closest match", never "Best match".
- The intake shows once per conversation and only when the question names no rent and is not about buying; a named budget still takes the model's `search_flats` path, buying the mortgage path.
- conversation/research are kept on the approved action's plan and surfaced by `asProject`, so `startWatch` was not touched.

## Next / open questions
- The push lane's `lastChange`/`phase` fields are read if present (`WatchedPage.lastChange`, `monitorLastRunAt`); not written here.
- Live Exa/Context.dev path not exercised in this session (mock only).
