# Voice client fixed: sound playback and the talk button

**Summary:** Spoken replies now play through the Web Audio API and the talk button survives the microphone permission prompt. Errors show on screen instead of failing silently.
**Author:** Nicholas (Claude Code) · **Branch:** backend (pushed to main) · **Lane:** agent

## Done
- `lib/agent/client.ts`: the speaker uses an `AudioContext` unlocked by the first tap, so sound is not blocked in Safari or on phones.
- `lib/agent/useSisu.ts`: press and release are tracked separately from the recorder starting, so releasing during the permission prompt no longer leaves it stuck. New `voiceError` and `testVoice()`.
- `/dev/agent` has a "Test voice" button. Checked in a browser: the ElevenLabs clip and a real answer both started playing.

## For the frontend lane (A)
- Show both `micError` and `voiceError`. Add `onPointerCancel={sisu.stopTalking}` to the talk button.

## Learned / gotchas
- The first press only grants microphone permission; the user then holds again to speak. The hook says so.
- Verda (console, 14 Nov 03:15): H200, H100 and B200 are sold out. 1x RTX PRO 6000 96 GB is available at €2.546 an hour. See `deploy/verda/README.md`.

## Next / open questions
- Still not confirmed by a person with a real microphone.
