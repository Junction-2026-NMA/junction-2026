# iPhone silent-switch fix merged into feat/web-port and live on sisu-demo

**Summary:** Nicholas's `fix/ios-voice-silent-switch` (b4d4efe) is merged into `feat/web-port` and deployed to https://sisu-demo.vercel.app. A check on a real iPhone with the silent switch on is still to do.
**Author:** Aristé (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- Merged `origin/fix/ios-voice-silent-switch` (no conflicts; it only touches `web/voice/AudioUnlock.ts` and `web/voice/VoiceRecorder.ts`). The shared AudioContext sets `navigator.audioSession.type = "playback"`, the recorder switches to `"play-and-record"` while the mic is open and back to `"playback"` after.
- All onboarding voice previews and Sisu's spoken replies play through `web/voice/SpeechPlayer.ts`, which uses that shared AudioContext, so they all get the fix.
- `tsc`, `npm run build` and `npm test` (474/474) pass.
- Deployed 8f2c51c to the `sisu-demo` project (production) from a clean `git archive`, at 15 Nov ~07:46 EET. Checked live: the deployment is Ready and aliased to sisu-demo.vercel.app, `/app` answers 200 for an iPhone user agent, and the served recorder chunk contains the `play-and-record` session switch.

## Next / open questions
- Still to check on a real iPhone with the silent switch on: the onboarding voice samples, then a spoken reply after using the mic. The iOS Simulator has no ringer switch, so it can't be checked there. `navigator.audioSession` needs iOS 17+. On older iOS the silent switch still mutes Web Audio.
