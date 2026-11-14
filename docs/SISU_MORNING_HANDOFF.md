# Morning handoff

Written at 04:45 Helsinki time on Saturday 14 November, after about two hours of unattended work.

## Where things stand

The backend can now carry a whole mobile Sisu experience: questions about the customer's money, live research, a saving worked out in code, a teaching question, an action that waits for approval, and a future that updates after it. No UI file was changed. Nothing was pushed, merged or deployed.

| | |
|---|---|
| Branch | `overnight/fable-lead`, in the worktree `~/Developer/sisu-fable` |
| Commits ahead of `main` | 13, all local. Run `git -C ~/Developer/sisu-fable log --oneline origin/main..HEAD` |
| Deterministic tests | 179 of 179 pass (`npm test`, 17 seconds, no keys needed) |
| Live evaluation | 54 of 54 on the closing run; 52 to 54 across the last five runs |
| Production build, type check, lint | clean |
| Changes to existing types or UI | none. `lib/types.ts` only gained types at the bottom |

## Three decisions that need you

1. **Push the branch?** It is local only, as your rules require. To share it with the team:
   ```bash
   git -C ~/Developer/sisu-fable push -u origin overnight/fable-lead
   ```
   Then open a pull request into `main`. Do not merge directly: `lib/types.ts`, `package.json` and `context/build-plan.md` are shared files, and teammates should see the change first.
2. **The Verda GPU is still running, at €2.58 an hour.** I did not start, stop or change it. Decided on Saturday morning: keep it on through judging. That costs about €100 of the €200 credit by Sunday 16:00. Note that on Verda, shutting an instance down does not stop the charge. Only deleting the instance does (the disk can be kept and a new GPU booted from it), and the RTX PRO 6000 was the only GPU type free when this one was rented.
3. **(Resolved: Creator plan, about 127,000 credits, since Saturday morning.)** Before that, ElevenLabs credit was the tightest resource. Tonight sent roughly 1,600 characters of speech. Check the real balance on the ElevenLabs dashboard before a day of voice demos, and decide whether to redeem the MLH code. Note that every server start speaks three filler lines (about 135 characters) to warm the voice.

## What was built

| Area | What now works | Where |
|---|---|---|
| Tools | 13 tools the model chooses from (was 4): spending, bills, pay cycles, patterns, affordability, scenarios with a target, mortgage, lessons, offers, web search, calculate, prepare an action (switch, standing or one-off transfer), remember | `lib/agent/tools/` |
| Investigation | `POST /api/agent/investigate`: Sisu finds what stands out, researches it live, works out the saving, teaches, and prepares an action. Seven typed stages in 4.2 to 5.3 s | `lib/agent/orchestrator.ts` |
| Receipts | Every number carries its source. Code checks every number the model says, and fixes a slipped digit or a misspelled provider before it is shown or spoken | `lib/agent/grounding.ts` |
| Actions | Prepare, approve, decline, expire. The model cannot approve. Hash-chained audit log | `lib/actions/`, `lib/store/` |
| Memory | Confirmed bill names, yearly kWh, preferences, goals. Consent, forget, audit | `lib/memory/` |
| Finance | Pay-cycle projection, nine kinds of pattern, affordability, seven lessons, mortgage application | `lib/finance/` |
| Vision | A photographed bill read on our own GPU in about 1.5 s | `lib/agent/vision.ts` |
| Resilience | Circuit breaker, mid-step failover, speech queue, research kept across restarts | `lib/agent/breaker.ts`, `model.ts`, `speech.ts` |
| Safety | Hostile text filtered from web pages, photos and pasted messages | `lib/agent/tools/untrusted.ts` |
| Frontend hook | `useSisu` gained `investigate`, `approve`, `decline`, `confirmBill`, `actions`, `memory`, and stages, teaching, receipts on each message | `lib/agent/useSisu.ts` |
| Mock mode | Every feature above works with no keys | `lib/agent/mock-model.ts` |
| Tests | 179 deterministic tests, a 54-check live evaluation, latency, failover, vision, voice and soak scripts | `tests/` |

## See it in two minutes

```bash
cd ~/Developer/sisu-fable
npm test                          # 179 tests, no keys
npm run dev -- --port 3310        # the tunnel to Verda must be up (the main checkout's dev server keeps it up)
```

Then open http://localhost:3310/dev/agent, untick "Speak replies" to save voice credit, and press **Investigate for me**. Guess the teaching question, press **Approve (simulation)**, and watch "Freed by approved switches" change. Then open http://localhost:3310/api/health.

In the Claude desktop app the same server is the preview named `sisu-fable`. I also added `sisu-fable-mock`, `sisu-fable-failover` and `sisu-fable-stall` to `Desktop/Design/.claude/launch.json`.

## What to read

| If you want | Read |
|---|---|
| To plug it into the screens | `docs/FRONTEND_INTEGRATION_CONTRACT.md` (give this to the frontend teammate) |
| To understand how it works | `docs/SISU_ARCHITECTURE_EXPLAINED.md` |
| What was tested, found and fixed | `docs/GAUNTLET_RESULTS.md` |
| What to tell each sponsor | `docs/SPONSOR_EVIDENCE.md` (includes a draft of the text NVIDIA asks for) |

## Next actions, in order

1. Decide on the push (above), then tell the frontend teammate to read the integration contract. Their work needs no change to keep running; the new cards are optional additions.
2. Test voice with a real microphone in Chrome or Safari at `localhost:3310/dev/agent`. Tonight's voice test used machine-made speech. This is the least tested path.
3. Try the bill photo with a real paper bill photographed on a phone. Tonight's test used a clean generated image.
4. Wire three things into the real UI, in this order of demo value: the approval card (section 5 of the contract), the investigation stages (sections 3 and 4), the teaching card (section 6).
5. Post the Verda summary in their Discord and paste the NVIDIA text into the submission. Both are drafted in `docs/SPONSOR_EVIDENCE.md`.
6. Record the backup demo video.

## What is still weak

The full list is at the end of `docs/GAUNTLET_RESULTS.md`. The ones that matter for the booth:

- **No login.** A customer ID is the only key. Fine for three synthetic profiles, not for anything real.
- **State is one file on this laptop** (`.sisu/state.json`). If the app is deployed to Vercel, actions and memory will not be reliable there. Demo from the laptop, or ask me to move the store to Postgres.
- **The model's answers vary.** A full evaluation run lands between 52 and 54 of 54. The usual miss is harmless (a correct answer that used one tool more than needed).
- **Most answers are 80 to 100 ms slower than last night**, because the model reads eight more tools. Last month's spending and the payday question are much faster (1.26 s to 0.47 s).
- **Live offers change between searches.** The best electricity offer for Aino was €67 a year at one point and €48 at another, because Exa returned different pages. Each is real and carries its links.
- **A burst of traffic sends a few seconds of turns to the NVIDIA backup.** The screen can show a "backup" tag from the turn's timings.

## Things I chose not to do without you

- Push, merge, deploy, or change any Vercel setting.
- Touch the Verda GPU or its server. Restarting it with a prompt cache or extra speed flags might cut another 50 to 100 ms from every answer, but it means four minutes of downtime and a risk nobody was awake to catch.
- Spend ElevenLabs credit in a loop. Voice was measured once.
- Read or change `.env.local`. The worktree's copy was made by the repo's own setup script.

## Notes for teammates' agents

- Lane B (finance engine and actions) had no owner, so this branch built `app/api/actions`, `app/api/demo`, `app/api/memory` and new files in `lib/finance/`. Existing finance files are unchanged except `lib/finance/transactions.ts`, which gained one exported function.
- `package.json` gained one dev dependency (`tsx`) and two scripts (`test`, `gauntlet`).
- The parallel Codex agent's branch (`overnight/codex-gauntlet`) had no commits when checked at 04:45, so there was nothing to integrate.
- Earlier entries in `context/log/` carry times about two hours ahead of the commit clock. Tonight's entries use the real Helsinki time.
