# Sisu landing page built at /sisu/index.html

**Summary:** A static Sisu landing page inside a rebuilt s-pankki.fi shell is in `public/sisu/`, served by the app at `/sisu/index.html`. It touches no shared file.
**Author:** Ariste (Claude Code) · **Branch:** feature/landing-page · **Lane:** frontend

## Done
- `public/sisu/index.html` with its own CSS and JS: the bank's header, breadcrumb and footer in Finnish, eight Sisu sections in English, and two "Open the Sisu demo" buttons that link to `/`.
- The header follows the live site: two rows, a "Katso lisää" menu for links that do not fit (`nav.js`), and a phone menu below 1024 px.
- Checked: `npm run lint` and `npm run build` pass, nothing scrolls sideways from 320 to 1920 px, and the page renders in Chrome and WebKit, with scripts off and with reduced motion.

## Decisions
- Plain files in `public/`, with no route and no config change, so `/sisu` alone is a 404. A clean `/sisu` address needs a rewrite in `next.config.ts` (shared file, not done). Affects: whoever links to the page.
- The page says "Concept for Junction 2026. Not an official S-Pankki page." at the top and in the footer, has no login form and asks search engines not to list it.
- Colours, radii and fonts come from the brand kit's `tokens.css`. The logo loads from s-pankki.fi; if it cannot load, the name shows as text.

## Learned / gotchas
- Two versions came out of an OmniForge gauntlet that was stopped before a verdict. The better one was finished by hand. The gauntlet's 98 sealed tests pass on the final page; no review verdict exists.
- Each `.css` and `.js` file in `public/sisu/` stays under 300 lines, and `npm run lint` covers the scripts there.

## Next / open questions
- The branch is 7 commits behind `main`: rebase before a PR.
- `context/landing/` holds five screenshots of s-pankki.fi (third-party material). Decide whether they stay before the branch is pushed.
