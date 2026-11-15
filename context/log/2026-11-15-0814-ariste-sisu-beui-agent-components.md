# Sisu chat rebuilt on beUI's agent components, in the Sisu look

**Summary:** The Sisu tab's chat now uses beUI's agent components (Message, MessageBubble, PromptInput, AgentActivity with ThinkingShimmer, VoiceOrb), ported into `web/agents/` and styled only with Sisu tokens. The visible tool trace now sits above each answer.
**Author:** Aristé (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- `web/agents/`: hand port of https://beui.dev/components/agents (MIT, `web/agents/LICENSE`). It keeps beUI's structure and `motion` animations. Its Tailwind/shadcn classes became plain CSS on the Sisu tokens (`agents.css`, `sisu-agent-*`).
- Transcript rows are `Message`s, which pop up once when new. The person's question is a solid green `MessageBubble`, with typing dots while a spoken question is still being heard (`TalkTranscript.tsx`, `AskParts.tsx`).
- The ask box is `PromptInput` (`Ask/Composer.tsx`). Its props, test ids and keyboard behaviour are unchanged.
- Tool trace: `Ask/AnswerActivity.tsx` (AgentActivity) replaces `StepsCard`. While Sisu works it shows a shimmering filler line over the steps, in place of the card's old "Sisu is thinking…" dots. When done it folds to "What Sisu did · N steps · Answered in X s". The Details no longer list the steps or the timing, so nothing is said twice.
- Voice dock: while the microphone is live it shows `VoiceOrb` in Sisu greens, following the conversation level (`VoiceStrip.tsx`). It draws nothing without WebGL.
- Checks: tsc 0 errors, eslint 0 errors, all `web/core/__checks__` pass, `npm run build` passes. Phone screenshots (402×874) of the typed flow, the trace open and closed, and the voice fixture with the orb look right.

## Decisions
- Ported by hand, not with `shadcn add`. The app styles with plain CSS, and the global `.sisu-root button` reset (unlayered) beats Tailwind's layered utilities.
- `package.json`: added `motion@14.9.0` and `lucide-react@1.66.0`, pinned exactly.
- Not ported: MessageScroller (the transcript keeps its reading-position rules), the prompt's action menu and model picker, and the approval, citation and code components.

## Next / open questions
- Check the orb on a real iPhone (WebGL in the home-screen PWA, battery).
- Not deployed to sisu-demo yet.
