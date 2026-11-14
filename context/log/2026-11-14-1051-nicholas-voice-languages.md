# Voice in 47 languages: Sisu hears which language is spoken and answers in it

**Summary:** Speech in, the agent's answer and speech out now follow the customer's language, with Finnish first and the main languages of India included. The default is auto-detect, so the frontend needs no change; a `language` option exists for a picker.
**Author:** Nicholas (Claude Code) · **Branch:** `overnight/fable-lead` (pull request 2) · **Lane:** agent

## Done
- `lib/agent/languages.ts`: 47 languages with ISO 639-1 and 639-3 codes and native names. Safe to import in the browser.
- Speech to text (`lib/agent/speech.ts`): no language is forced on auto; a chosen language is passed as a hint; the detected language and its confidence come back. Numbers arrive as digits.
- Agent: `AgentRequest.language` (optional). When known, the prompt ends with "Answer in <language>". Filler lines exist in English, Finnish, Swedish and German (`lib/agent/fillers.ts`).
- Text to speech is told the language (`language_code`), and the audio cache is per language.
- `useSisu({ language })`, default `"auto"`; returns `heardLanguage`. `GET /api/voice/tts` lists `languages` for a picker. The test bench has the picker.
- Live check (`tests/gauntlet/voice-languages.mjs`): Finnish, Swedish, German, Hindi, Tamil, Arabic, and Finnish with live research: 7 of 7 heard correctly and answered in kind, numbers sourced. 194 unit tests pass.

## Decisions
- A detection under 60% confidence is not acted on; the model then follows the words.
- In a language with no filler translation Sisu stays silent during research instead of switching to English. Affects: frontend should show progress on screen.
- `ELEVENLABS_STT_LANGUAGE` now defaults to empty (auto-detect) instead of `en`.

## Learned / gotchas
- Speech to text reports ISO 639-3 (`fin`), text to speech takes ISO 639-1 (`fi`); `findLanguage` accepts both.
- Hindi, Urdu, Arabic and Chinese end sentences with their own marks, so the sentence splitter had to learn them or speech would only start when the whole answer was done.
- The ElevenLabs account is now on the Creator plan (about 127,000 credits), so voice testing is no longer rationed. `ELEVENLABS_MAX_CONCURRENT` is still 2; raise it in `.env.local` if the plan allows more at once.

## Next / open questions
- Text that code writes (lesson options, action checklists, stage titles) is still English. Translating it is a separate piece of work.
- Not tested: a real person speaking, accents, booth noise. A native speaker should listen to the Finnish voice and pick the best-sounding one on `/dev/agent`.
