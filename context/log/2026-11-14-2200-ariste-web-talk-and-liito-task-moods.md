# Web app follows the three-tab iOS version (Today, Talk, Path); Liito acts out what the backend is doing

**Summary:** `/app` now opens on Talk, a hands-free voice conversation with Liito, and Liito visibly listens, writes, searches, calculates, compares and presents, driven by the agent's real events.
**Author:** Aristé (Claude Code) · **Branch:** feat/web-talk (from feat/web-port + main) · **Lane:** frontend

## Done
- Web port of the newest iOS version (uncommitted in the frontend worktree): three tabs, Talk as the main page, the written conversation as a sheet over it (`web/features/Talk/`, `web/voice/ConversationController.ts`, `web/core/AppLogic/Conversation.ts` with 153 checks). Jars stays in the code, out of the bar, as on iOS.
- The microphone opens per question and closes while Sisu answers; the level comes from a Web Audio analyser (`web/voice/VoiceRecorder.ts`). Questions go through the existing `/api/voice/turn`.
- Rive: six new `LiitoMood` values after the old ten (enum ids 0:251 to 0:256): listening, writing, searching, calculating, comparing, presenting. Made with `rive/tools/liito-gen.py` (now the way to change Liito); the old ten moods render pixel-identical.
- `web/core/LiitoTask.ts` maps agent events to those moods (tools, stages, research, visuals, text deltas, spoken sentences); Talk and the Ask header use it.

## Decisions
- `rive/contract.json` gains six enum values (additive); `ios/SisuCore` `RiveBindings.LiitoMood` gained the same six so the contract tests pass (SisuCore 205 tests pass). Affects: iOS app owner (nothing else changes).

## Next / open questions
- A second round of testers runs now; backend bugs they found go on a separate fix branch for Nicholas.
