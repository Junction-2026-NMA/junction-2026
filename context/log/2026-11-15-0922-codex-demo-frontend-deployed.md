# Demo frontend deployed; backend release still blocked

**Summary:** The frontend fixes are live on sisu-demo; updated full demo acceptance needs the backend owner to deploy source commit `19f1f35`.
**Author:** Codex · **Branch:** feat/web-port · **Lane:** frontend + agent

## Done
- Pushed source to `origin/fix/demo-question-reliability` and verified its tip `19f1f35`. Preserved the concurrent desktop no-code change by rebasing onto `origin/feat/web-port` (`12b3479`).
- Deployed a clean archive of `19f1f35` to https://sisu-demo.vercel.app. Vercel deployment `dpl_35dBoreByRgMoH2NQedUR2EpQGoy` is READY; app reload and saved project history verified.
- Final source checks: 492 unit tests and 1,420 web checks pass, TypeScript/build pass, lint has zero errors and two existing warnings. Local HTTP housing minimum and electricity approval flows pass with labelled mock data; real sponsor tool calls were checked separately.

## Next / open questions
- `/api` still forwards to the older sisu-api. Its actual Aino run has conflicting electricity answer/card figures, an affordability-access contradiction and missing source/unknown-cost claims in saved findings. Full updated deployed acceptance is BLOCKED.
- The signed-in account cannot access sisu-api. The secure backend-token request was declined; no alternative credential request or backend deployment was attempted. Owner must deploy `19f1f35` there, then repeat both sequences.
- The optional in-app banner opens unread findings; the existing live test finding is already read. Phone push was not added.
