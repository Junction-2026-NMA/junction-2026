# Landing page branch and inputs staged

**Summary:** `feature/landing-page` holds the inputs for a static Sisu landing page at `public/sisu/`, shown as a subpage inside a rebuilt s-pankki.fi shell. The page itself is not built yet.
**Author:** Ariste (Claude Code) · **Branch:** feature/landing-page · **Lane:** frontend

## Done
- Brand tokens, a Liito image and four basket icons are in `public/sisu/`.
- Reference material is in `context/landing/`: five brand-kit docs and five screenshots of www.s-pankki.fi taken 2026-11-14. Start with `context/landing/README.md`.

## Decisions
- The landing page is plain HTML, CSS and JS in `public/sisu/`, served at `/sisu/index.html`. It touches no shared file (`app/`, `components/`, `lib/`, `package.json`, config). Affects: no other lane.
- The bank shell is in Finnish and its links go to the real s-pankki.fi pages. The Sisu content is in English. There is no login form, and the page shows "Concept for Junction 2026. Not an official S-Pankki page."
- The S-Pankki logo loads from s-pankki.fi and is not committed. The bank's fonts are proprietary and are not used.

## Learned / gotchas
- The brand kit lives only on the `brand-kit` branch, so the files the page needs are copied here.
- `liito-glide.png` has an opaque green background, so the page shows it as a sticker.
- The repo has no test runner. Checks for the page use `node --test`.

## Next / open questions
- Build the page (an OmniForge run is starting), then check it by eye at 390 px and 1280 px.
