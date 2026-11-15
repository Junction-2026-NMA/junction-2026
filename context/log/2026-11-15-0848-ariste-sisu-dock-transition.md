# Sisu tab dock: one microphone, one animated switch between voice and typing

**Summary:** The Sisu tab's dock is now one component (`web/features/Talk/SisuDock.tsx`). The keyboard button stretches into the text field while the mic glides to its side, and the mic is the same Sisu-green control in voice, typing and live voice.
**Author:** Aristé (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- `SisuDock.tsx` + `dock.css` replace `VoiceLauncher.tsx`, `Ask/Composer.tsx` and `VoiceDock` (VoiceStrip). The mic and keyboard elements are never unmounted, and CSS transitions do the movement:
  - the grid's leading track closes;
  - the mic shrinks 64 → 52 px;
  - the 52 px keyboard circle widens into the field from the trailing edge;
  - Send sits where the keyboard glyph was and fades in after it leaves;
  - an empty field folds back the same way;
  - Reduce Motion gets a fade only.
- The mic is solid green with a white glyph in voice and typing modes (it used to be a pale tinted 52 px button beside the field). Live voice shows the orb inside it; muted turns it white with a slash.
- Fixed: tapping the mic beside an empty field now starts voice. Before, the blur unmounted the mic first, so the tap only closed the field.
- "Type instead" during voice now focuses the field inside the tap, so iOS raises the keyboard.
- `PromptInput` has a `bare` variant, so the dock draws the pill and its focus ring.
- Checks: tsc and eslint 0 errors, all `web/core/__checks__` pass, build passes. In a phone-sized browser: keyboard → typing (field focused), mic → live voice (fixture), type instead → typing (focused), leave the field → voice; no console errors.

## Next
- Not pushed; PR #28 (feat/web-port) gets it on the next push. Check the motion on a real iPhone with the keyboard rising.
