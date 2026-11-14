# Sisu now acts instead of describing: one-off transfers, calculator, sentence guards, visible steps

**Summary:** A real voice test showed Sisu refusing or only talking about things it could do. It now does them, shows each step on screen as it happens, and code throws away any sentence that claims work that was not done.
**Author:** Nicholas (Claude Code) · **Branch:** `overnight/fable-lead` (pull request 2) · **Lane:** agent, actions

## Done
- `lib/agent/prompt.ts` rewritten around "act first". The summary now carries how safe-to-spend is worked out, room to save, and how long the balance would last.
- New tool `calculate` (`lib/agent/tools/calc.ts`): arithmetic in code, with each figure's unit and source. 13 tools in all.
- `prepare_action` gained `one_off_transfer` and a `destination` (savings or investments). A transfer the customer names is always set up, with a `warning` and the safer amount if it would overdraw the account (`lib/actions/drafts.ts`, `lib/finance/saving.ts`).
- `lib/agent/guards.ts`: every sentence is checked before it is shown or spoken. A false "I've set it up", "I searched", "let me check", "would you like me to look that up?" or an unsourced number stops the step; the model retries, forced to call a tool. At most two retries a turn.
- A request to move a named amount starts with a forced `prepare_action`; an open request for advice starts with `find_patterns`.
- The verifier accepts the sum or difference of two sourced figures in the same answer, because code can check it.
- Screen: `tool_start.label` and `message.steps` say what Sisu is doing in plain words; a `replace` event carries the text that still stands after a sentence is thrown away.
- `tests/gauntlet/replay.mjs` replays the 12-turn conversation that failed: 5 of 12 before, 12 of 12 now. 229 unit tests pass. Live evaluation 53 of 54, no unsourced numbers.

## Decisions
- Sisu sets up what the customer asks for even when it advises against it, and says the warning. It never refuses a transfer the account can cover. Affects: frontend must show `action.warning`.
- Sisu does not pick funds or shares; it moves money to the customer's own investment account and says investments can lose value.
- Guard notes go to the model as "notes from the app"; sentences addressed to the app are dropped.

## Learned / gotchas
- Telling the model "do not claim what you did not do" in the instructions was not enough in long conversations. Checking each sentence in code was.
- A guard that is skipped "because the customer has some action" misses a false claim about a different kind of action. Match the kind.
- The number verifier cannot see units. Make the tool carry them.
- Named `tool_choice` works on our vLLM server.
- Speech to text is now given key terms (Sisu, S-Pankki, Exa, Kela …) because "Exa" was heard as "Exxon". Not yet re-tested with a real voice.

## Next / open
- Frontend: draw `steps`, `action.warning` and `action.confirmation` (sections 2a and 5 of `docs/FRONTEND_INTEGRATION_CONTRACT.md`).
- Everyday-life estimates vary with the web results; consider fixed reference values for water and heating.
