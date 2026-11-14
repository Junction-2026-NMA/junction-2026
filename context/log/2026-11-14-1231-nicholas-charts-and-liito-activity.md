# For the frontend agent: Sisu now sends charts, and tells Liito what it is doing

**Summary:** The agent sends animated-chart data with its answers, and both hooks expose one `activity` value that says what Sisu is doing right now and which Liito pose fits. The frontend's job is to draw the charts and connect Liito's animation to `activity`.
**Author:** Nicholas (Claude Code) · **Branch:** `overnight/fable-lead` (pull request 2) · **Lane:** agent, plus new pages `app/visuals/` and `app/plan/` (no existing screen was changed)

## Frontend agent: do this
1. Read `docs/FRONTEND_AGENT_HANDOFF.md`. It is short and has the exact imports.
2. Drive Liito from `useSisu(...).activity` and `usePlan().view.activity`: map `activity.liito` (one of the eight brand-kit poses) to the animation and show `activity.label` beside it. Never from a timer.
3. Draw `message.visuals` with `<VisualCard />` from `app/visuals/VisualCard.tsx`.
4. Lift `Stage` and `PlanCard` from `app/plan/` for the "sort out my money" moment, with Liito beside the stage.

## Done
- `lib/agent/visuals.ts`: six chart kinds built in code with receipts (budget ring, you beside people your age, months, safe-to-spend build-up, three futures, your bill beside offers). New `visual` event; `message.visuals` in `useSisu`.
- New tool `show_chart` (14 tools). A request for a picture starts with it. Advice, scenarios and offer searches attach their own chart.
- `app/visuals/`: `VisualCard` and the animated SVG charts; gallery at `/visuals`; `GET /api/agent/visuals`.
- `lib/agent/activity.ts`: `nextActivity` and `nextPlanActivity`; `activity` on both hooks; `usePlan` moved to `lib/agent/usePlan.ts`.
- 242 unit tests pass. The 12-turn replay still passes 12 of 12.

## Decisions
- Charts are data, not images: the model picks which chart, code builds it, the screen draws it. Each has a code-written `summary` the model describes it from. Affects: frontend may restyle but must not take numbers from the model's text.
- The six category colours are a checked colour-blind-safe set in a fixed order; "Other" is grey.
- `activity.liito` uses the brand kit's pose names so the mapping is one line.

## Learned / gotchas
- Given only the first few figures of a 12-month chart, the model described half the year as the whole. It now gets a code-written summary instead.
- An element with a fade-in animation that ends at opacity 1 ignores an `opacity` attribute; use `fill-opacity`.
- The in-app preview pauses CSS animations while it is not being painted; that is the preview, not a bug.

## Next / open
- No Liito animation exists in the repo yet (the brand kit has drawings only). The pages print `Liito: <pose> · <label>` as a stand-in.
- Use `proud` instead of `cheering` when a whole plan is approved; the hook sends `approved` for both.
