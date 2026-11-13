# Electricity savings no longer overstated

**Summary:** Savings now scale with the customer's own bill and come out at 12 to 15% of it. Before, a flat 2,000 kWh assumption claimed 60 to 81% (for example €765 a year on a €947 bill).
**Author:** Nicholas (Claude Code) · **Branch:** backend (pushed to main) · **Lane:** agent

## Done
- `lib/agent/research/compare.ts`: use is estimated from the bill at the median fixed price of the live offers; a stated yearly kWh overrides it; the comparison is capped to the energy part of the bill.
- `ResearchResult` gained `assumedYearlyKwh` and `usageSource` ("stated", "estimated-from-bill", "default") in `lib/types.ts`.
- `search_offers` and `POST /api/research` accept an optional `yearlyKwh`. Sisu invites the user to give it and recomputes.

## For the frontend lane (A)
- Show `assumedYearlyKwh` and `usageSource` on the offer card, with a field to enter real yearly kWh (then call `POST /api/research` with `yearlyKwh`).

## Learned / gotchas
- Do not switch git branches while `next dev` is running: the server lost the `/dev/agent` route and one changed file until restarted. Push with `git push origin backend:main` instead.
- Context.dev sometimes returns a monthly fee of 0 or null for the same plan on different reads; a null fee counts as 0.

## Next / open questions
- Verda's ready-made inference offers only Kimi and DeepSeek, so Nemotron must be self-hosted on a GPU instance there.
