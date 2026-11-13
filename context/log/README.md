# Team context log

Shared memory for every person **and every AI agent** working on Sisu. Every chat, whether in Claude Code, Codex, Cursor, ChatGPT or claude.ai, adds what it learned here. Every new session reads it first.

## Rules

1. **One new file per entry and never edit someone else's entry.** That way nobody gets merge conflicts. To correct something, add a new entry that says what it replaces.
2. **File name:** `YYYY-MM-DD-HHMM-<name>-<topic>.md`, using Helsinki time and lowercase with dashes. For example, `2026-11-14-0930-nicholas-exa-search-route.md`.
3. **When to write one:**
   - before you commit a working chunk;
   - when you make a decision others depend on;
   - when you discover something non-obvious (an API quirk, a data gotcha or a dead end);
   - at the end of a session.
4. **Keep it short:** 5–20 lines and facts only. Link files instead of pasting code.
5. **Never include** API keys, tokens, `.env` values, promo codes or personal emails. This repo is public.
6. **If it changes a team decision** (scope, API contract or roles), also update `context/build-plan.md` or `lib/types.ts` on `main`, and say so in the entry.
7. Commit the entry with your work. Push your branch so teammates' agents can see it.

## Template

```markdown
# <What this entry is about, one line>

**Summary:** <one sentence: the single most useful thing a teammate should know>
**Author:** <name> (<tool, e.g. Claude Code / Codex / ChatGPT>) · **Branch:** <branch> · **Lane:** frontend | financial engine | agent

## Done
- <what now works, with file paths>

## Decisions
- <decision> (why). Affects: <who/what>

## Learned / gotchas
- <non-obvious fact, API behaviour, data quirk>

## Next / open questions
- <what's next, what's blocked, who needs to answer>
```

## From a web chat (ChatGPT, claude.ai, Gemini)

Paste this at the end of the chat, then save the answer as a new file here:

> Summarise this conversation as a team context log entry for our hackathon repo. Use exactly this template: a `# title` line, then `**Summary:**`, `**Author:**`, and the sections Done / Decisions / Learned / Next. Keep it under 20 lines and facts only. Leave out API keys, codes and personal details.

To share a whole chat, export it to `context/chats/<name>-<topic>.md`, the way `context/chatgpt-ideation-chat.md` was shared. Then add a short log entry that links to it.
