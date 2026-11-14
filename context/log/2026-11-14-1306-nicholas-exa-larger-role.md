# Exa now reads pages and researches open questions, not only finds links

**Summary:** Exa has three jobs: search, reading an offer page when Context.dev cannot, and researching open questions across several sources. The money plan uses the last one to show rules and prices worth checking beside the customer's own figures.
**Author:** Nicholas (Claude Code) · **Branch:** `agent/exa-larger-role` (from `main` after pull request 2 was merged) · **Lane:** agent

## Done
- `lib/agent/research/exa.ts`: `exaReadPage` (POST /contents with a summary schema) and `exaResearch` (POST /search, type `deep-lite`, with a written answer and its sources). `EXA_DEEP_TYPE` switches to `deep`.
- `lib/agent/research/reader.ts`: Context.dev reads first, Exa reads when it fails; one 10-minute page cache for both; each citation says who read it (`readBy`). A plan reads three pages a bill again.
- `lib/agent/checks.ts`: code picks up to two questions from the customer's figures (housing allowance, savings rates, typical rent). New plan events `check_start` and `check_done`; `plan.checks`.
- `web_search` takes `deep: true` for open questions; a filler line is spoken while it runs.
- `/plan` shows the research in blue lanes and a "Worth checking" section. Use `/api/dev/exa?read=<url>` or `?research=<question>` to try Exa alone (development only).
- Live: for Aino, the 2026 Kela income limit (€1,844 a month for one adult in Helsinki) beside her €1,783, with sources, in 1.9 s. 248 unit tests pass.

## Decisions
- The API, not Exa's MCP server: the MCP offers the same search and fetch through an extra hop, and our agent is not an MCP client.
- A check is "what the sources say today", shown beside the customer's own figure. Sisu never says the customer qualifies. Affects: frontend must keep the sources and that wording.
- Exa is the second reader, not the first, so Context.dev stays in the core flow.

## Learned / gotchas
- Exa's summary schema takes one type per field: `["string","null"]` is rejected. `singleTypes` converts it.
- `deep-lite` answered in 1.7 to 2.8 s here, faster than the 4 s its docs give.
- A dev server that had the old module loaded kept calling it after the edit; restart after changing exports.
- The calculator read "1,000" as 1. It now treats a comma before exactly three digits as thousands.

## Next / open
- Exa's write-up can name products (banks and their rates). It is shown as what sources say, not as a recommendation; decide whether to hide names.
- The research queries are in English; Finnish sources still come back.
