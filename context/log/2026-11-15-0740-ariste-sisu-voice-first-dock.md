# Sisu tab: voice-first dock, no suggestion list

**Summary:** The Sisu tab's dock is now voice first (a large microphone in the middle, a small keyboard button on the side); the keyboard button opens the old text field with Send and the mic, and an empty field goes back to voice.
**Author:** Aristé (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- `web/features/Talk/VoiceLauncher.tsx` (new): centred mic (`talk.start`) and keyboard button (`talk.keyboard`), wrapper `talk.launcher`. Styles in `web/features/Talk/talk.css`.
- `web/features/Talk/TalkScreen.tsx`: shows `Ask/Composer.tsx` only while typing, with an unsent draft, or while Sisu works on a typed question (so Stop stays). The keyboard button focuses the field inside the tap (`flushSync`) so iOS raises the keyboard; "Type instead" in the voice strip opens it too. Blurring an empty field returns to the voice-first dock.
- The empty state no longer lists suggested questions (owner's request): Liito and one greeting, centred (`SisuEmptyState.tsx`).
- Checked in a 402x874 mobile Playwright viewport: both states render, the keyboard tap focuses `ask.field`, blur returns to the launcher. `tsc` and eslint clean.

## Next / open questions
- Not deployed; sisu-demo still shows the previous dock until the next web deploy.
