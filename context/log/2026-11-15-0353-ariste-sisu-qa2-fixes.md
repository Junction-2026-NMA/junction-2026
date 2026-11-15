# Sisu tab QA round 2: the buffer goes with every question, stopped replies, spoken dates, reading position kept

**Summary:** Every typed and spoken question now carries the person's buffer as `bufferEur` (left out when none is set), so the server can answer with the same buffer Today uses once its half lands.
**Author:** Ariste (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- Buffer: `CoachSession.bufferEur` (set via `CoachStore.setBuffer`, from `AppModel` prefs) goes into the `/api/agent/query` body and the `/api/voice/turn` form (`CoachEndpoints.voiceTurn`).
- Stop before any text: a blank reply becomes "Stopped before Sisu answered." with Try again (`CoachSession.settled`, `ConversationHistory.storable` never saves a blank reply).
- Speech: `web/core/SpokenText.ts` turns ISO dates into "15 October" (the year only when it is not this year, in the answer language) and `€-12` into "minus 12 euros" before TTS. The screen text is unchanged.
- Tab switch: the draft is kept per conversation in `CoachStore` (cleared on Send and New chat), and the reading position in `TalkTranscript` (`readingPositions`).
- "Jump to latest" is now a 44 px round button at the bottom right. It shows only when new content arrives below the view, not when a Details section is opened.
- Launch: a new `restoringCustomer` state and a "restoring" route in `RootView` show only the background until the stored profile, its overview and its coach session are ready. The profile chooser no longer flashes.
- Small fixes: voice strip hints ("Tap Stop to interrupt.", "Ask more, or tap End.") wrap to two lines; the logo's name includes "new project findings" when unread; the drawer's Settings icon is a toothed cog; a top fade replaces the cut-off text under the header; with the keyboard up the empty-state Liito shrinks and the hint is hidden; the peer suggestion says "other profiles in the demo data" and is skipped when the 20% question covers the same category.

## Next / open questions
- The answers lane should add `bufferEur?: number | null` to `AgentRequest` (`web/core/CoachModels.ts`). Until then the session spreads the field into the body.
- The backend half (lib/types.ts, the routes, getCashFlow) must read `bufferEur`.
