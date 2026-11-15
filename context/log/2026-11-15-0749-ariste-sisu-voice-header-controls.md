# Sisu tab in voice: live state and Stop in the header, mic and keyboard in the dock

**Summary:** While a voice conversation runs, the header shows "Thinking · 0:11" (live dot) under the title and Stop/End at the top right in place of the small Liito; the dock keeps the voice-first layout (mic in the middle mutes, keyboard on the right).
**Author:** Aristé (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- `web/features/Talk/VoiceStrip.tsx`: now `VoiceStatus` (header line), `VoiceStopButton` (header, `talk.stop`/`talk.end`) and `VoiceDock` (`talk.voice`: centred mic = `talk.mute`, keyboard = `talk.type`). The old one-row strip is gone.
- `TalkScreen.tsx`: the small header Liito shows only in typed chats; with voice on its place is the stop control. "Conversation on · 0:11" is replaced by the voice state and clock ("Microphone off · 0:11" when muted).
- Checked with `voicefixture=1&talkStart=1` in a 402x874 mobile viewport: Hearing you → Thinking (Stop) → Listening (End), mute toggles. `tsc` and eslint clean.
