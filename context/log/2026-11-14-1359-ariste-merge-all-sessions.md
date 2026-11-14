# All of Aristé's open sessions merged to main, unfinished work included

**Summary:** iOS app, landing page, story pass and UI round 2 (hero, daily, week, close) are on `main`; several were unfinished and are committed as `wip:`.
**Author:** Aristé (Claude Code) · **Branch:** integrate/all-sessions-2026-11-14 · **Lane:** frontend

## Done
- Merged `feature/frontend` (iOS app in `ios/`, `rive/`), `feature/landing-page`, `ui/story-pass`, `ui/r2-hero`, `ui/r2-daily`, `ui/r2-week` and `ui/r2-close`.
- `wip:` commits hold work that was still in progress: iOS onboarding, glass tab bar, plan session; landing journey section; all four round 2 passes.
- Checks on the merge: `next build` passes, `npm test` 251/251, `npm run lint` clean, `swift test` in `ios/SisuCore` 205/205.

## Decisions
- `public/sisu/` conflicts: the round 1 + round 2 landing page wins over the story pass hero. The story pass journey section (`journey.css`, `journey-motion.css`, `journey.js`) is kept and linked in `index.html`.
- Daily panels: round 2 daily's `panel-slot` layout and copy, with round 2 hero's shorter tick lists.

## Next / open questions
- The `wip:` work is unfinished; whoever picks it up should check the landing page in a browser, especially the hero vs journey section.
