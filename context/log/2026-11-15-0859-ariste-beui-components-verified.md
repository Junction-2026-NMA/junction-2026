# beUI chat components: all 16 verified in the running app, mock and hosted backend; sisu-demo is behind

**Summary:** Every beUI component in the Sisu chat now shows in a production build, on both the mock backend and the hosted `sisu-api` backend. The deployed sisu-demo only has the first beUI round (`f84cd54`), not the approval card, quiz, citations, Copy, timer, search rows or the new dock.
**Author:** Aristé (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- A phone-sized Playwright pass (typed question, "Look into my finances", voice with the bundled clip) recorded each component as it became visible. A 30 ms poller in the page catches short-lived states. 16/16 on the mock backend. On the hosted backend (a local build with `SISU_API_ORIGIN=https://sisu-api.vercel.app`), real Exa pages showed in the search rows and citations, a real switch in ToolApproval, and the quiz rendered. All shown there too, except the collapsible: its test question was under the old length cut-off.
- Fixed: `MessageBubbleCollapsible` now measures itself (`web/agents/Message.tsx`). A question past five lines collapses with "Show more"; a short one shows whole with no control. The 240-character cut-off is gone (a 228-character question was 7 lines and not collapsed).
- Checked: the typing dots render (`MessageTyping`). With the bundled clip and the mock backend they last about 20 ms because the mock transcribes at once; on the hosted backend they last as long as speech-to-text takes.

## Learned / gotchas
- sisu-demo's loaded CSS has `sisu-agent-orb`/`-activity`/`-bubble` but none of `-approval`, `-question`, `-citation`, `-response-actions`, `-progress`, `-search` or `sisu-dock-*`. The later commits need a deploy before they show there.
- `/app` loads its CSS lazily (the app is `next/dynamic`), so to see what a deployment has, read `document.styleSheets` in a browser, not the first HTML.

## Next
- Deploy `feat/web-port` to sisu-demo (after the team's OK) and push to PR #28.
