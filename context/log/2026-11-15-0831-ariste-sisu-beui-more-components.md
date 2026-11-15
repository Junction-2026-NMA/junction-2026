# More of the Sisu chat on beUI: action approval, quiz, sources, search trace, copy

**Summary:** The simulated action card is now beUI's ToolApproval and the teaching quiz is beUI's ApprovalCard question mode. Sources are a CitationList, and the tool trace shows each web search's query and pages with a live timer. Finished answers get a Copy action. Everything is still styled only with Sisu tokens.
**Author:** Aristé (Claude Code) · **Branch:** feat/web-port · **Lane:** frontend

## Done
- `web/agents/`: added AgentDisclosure, AgentProgress, ToolApproval, ApprovalQuestion, Citations (CitationList), ResponseActions and MessageBubbleCollapsible. AgentActivity gained search rows.
- `Ask/ActionCard.tsx` uses ToolApproval. The icon and badge follow the decision, "Simulated, no real switch" sits under the title, the checklist is the details, and Approve / Decline (still Sisu's Rive buttons) are the action row, which gives way to the outcome. Warnings and the mismatch note stay in the body.
- `Ask/QuizCard.tsx` uses ApprovalQuestion and no longer uses the Rive ChoiceCard. The first tap is still the guess, and a wrong pick is amber, never red.
- `Ask/AnswerActivity.tsx`: a live timer (AgentProgress), plus each research stage's query and its first three pages under its tool call (`Stage.toolCallId`). The provider name and "Mock data" are labelled.
- Details → Sources is a numbered CitationList with the fetch time. Copy sits under a finished answer. A question over 240 characters is clamped with "Show more".
- Checks: tsc and eslint 0 errors, all `web/core/__checks__` pass, build passes. Phone screenshots show working, done, trace, sources, copy (clipboard verified), action pending → approved, and the quiz before and after.

## Learned / gotchas
- Port 3417 (the README smoke-test port) was taken by the v3 worktree's `next start`, so screenshots from it show v3's build. I used 3437.
- `WatchActionCard` and the Projects files were left alone because the v3 branch edits them. `AssistantAnswer.tsx` and `AnswerDetails.tsx` will need a small manual merge with v3.

## Next
- Not pushed or deployed. Check the orb and the new cards on a real iPhone.
