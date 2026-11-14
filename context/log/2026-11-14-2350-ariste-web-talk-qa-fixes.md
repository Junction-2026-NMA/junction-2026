# Web Talk and Liito: fixes from four automated QA passes

**Summary:** Hands-free Talk no longer mistakes background noise or babble for a question, never sticks on "Thinking", never swaps a live answer for a canned sample, and Liito shows each real task for about a second in event order.
**Author:** Aristé (Claude Code) · **Branch:** feat/web-talk · **Lane:** frontend (backend fixes on fix/backend-qa for Nicholas)

## Done
- Endpointer (web only, `web/core/AppLogic/Conversation.ts`): "no audio yet" readings (-160 dBFS) are ignored, the room is measured from real readings, background voices neither start nor prolong a question, a one-word "No." counts. Proven with recorded noise, babble, cough and speech files.
- `SpeechPlayer.stop()` reports drained, so a typed question during speech no longer leaves Talk on "Thinking" for ever.
- Agent turns never fall back to the bundled sample after the server has answered once (a network blip is an error with "Try again").
- Talk follows work started in the sheet; early End/interrupt leaves no empty bubbles; voice problems show as one line under the controls.
- Liito: `sentence` events no longer mean presenting (they come in silent typed turns too); stage bursts only move the task forward; `web/core/MoodSequencer.ts` holds each real task about 1 s (71 checks); the chat badge no longer clips props; reduced motion holds each pose still.
- Celebration shows above the conversation sheet; the Today hero and the celebration answer a finger tap (Rive canvases swallow touchend); Enter on an empty bill name confirms nothing.
- Merged: main up to #16, feat/web-port c90c157 (button min height), fix/backend-qa.

## Learned / gotchas
- On live, a tool's start, end, result and stage records arrive within ~15 ms, so a mood per event is invisible; show them in sequence.
- iOS has the same `stop()`-never-drains and stage-burst behaviour; worth porting back.

## Next / open questions
- Backend (Nicholas): fix/backend-qa needs merging and a sisu-api redeploy. Still open there: the model sometimes claims a switch is set up without an action card, and off-topic questions trigger a paid web search.
