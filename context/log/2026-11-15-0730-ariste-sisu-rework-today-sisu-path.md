# Sisu rework: Today / Sisu / Path, short answers, consistent offers, weekly budget, Projects

**Summary:** The web app at sisu-demo now has a Sisu tab (typing and voice in one chat, history drawer, Projects) and a simpler Today; the backend half is in the PR from `feat/sisu-rework-api` and needs merging plus a sisu-api redeploy before the live answers match the screens.
**Author:** Aristé (Claude Code) · **Branch:** feat/sisu-rework-api (web: feat/web-port) · **Lane:** frontend + agent + financial engine (owner's brief, for Nicholas to review)

## Done
- Web (deployed 15 Nov ~07:15 EET from feat/web-port 42f50c2): Talk renamed Sisu, conversation and input on open, no typing sheet; logo opens Chat history (previous chats, Saved projects, New chat, Settings); suggestions; answers = short text + one result + closed Details; "Jump to latest"; Today = Estimated weekly budget (balance − bills before payday − buffer, buffer settable), one insight, three basket buttons (Regular essentials / Occasional essentials / Everyday spending), recent payments; no berries/streaks/jars; Path unlocks in order with follow-up questions; Settings for voice and language with preview; texture background.
- Backend (this branch, `lib/types.ts` changes are additive and optional): offers ranked only among those meeting the stated requirements, "No matching options found", unknown fees stay unknown, seasonal tariffs not ranked; `CashFlow.weeklyBudget` and `bufferEur` on agent requests and cash-flow; neutral basket names everywhere; shorter conversational answers; `TeachingCard.followUp` / `whyWrong`; Projects on watches: `GET /api/watch/:id`, pause, resume, `PATCH`, read, housing effect (recurring vs upfront, missing listed), honest monitoring copy, daily review cron.

## Decisions
- A Project is a watch; the approval card is the consent. Affects: Nicholas (watch routes).
- The client never claims continuous monitoring unless `/api/health` reports the scheduler.

## Next / open questions
- Nicholas: merge the PR, run `deploy/supabase/sisu_watch_sessions.sql`, set `CRON_SECRET` on sisu-api, deploy (the `crons` entry is in vercel.json; Hobby runs it once a day). Until then the live agent says "safe-to-spend" and its payday figure differs from Today's.
- Prompt changes were tested with the mock model only (no keys locally): check a few live answers after the deploy.
