# iOS app: lighter look, Liquid Glass tab bar, first-run onboarding, one demo disclosure

**Summary:** The app is near-white with white cards, has a floating glass tab bar with a green pill that moves with the selection, and opens with a four-tap onboarding that ends on a real spending insight for the chosen profile.
**Author:** Ariste (Claude Code) · **Branch:** feature/frontend · **Lane:** frontend

## Done
- Look: near-white screen (`#F6F8F7`), white cards with a hairline, dark text; green only for actions, selection, progress and baskets. Rules in `ios/BRAND.md`.
- Tab bar (`ios/Sisu/Shared/GlassTabBar.swift`): custom, because the iOS 26 system bar's selection highlight cannot be tinted green and falls back to a flat bar before iOS 26. Native glass on iOS 26, system material on 17–25, solid with Reduce Transparency; hidden with the keyboard on Ask.
- Onboarding (`ios/Sisu/Features/Onboarding`): welcome, the three baskets, pick a demo profile (the one demo disclosure), then Today with a first-insight card backed by the profile's transactions. Remembered across launches; "Start the demo over" replays it.
- "Sample data" badges removed; Settings > Data and sources shows where figures come from and when; a live-to-demo fallback is announced once, in place.
- Onboarding research from five finance apps in Appllama (Copilot, Monarch, Rocket Money, Fleur, Monefy).
- Checks: 205 core tests, 20 hosted tests, 23 UI tests across five suites, all passing.

## Next / open questions
- Plan screen (`PlanSession` is ready in SisuCore), charts from `visual` events, Liito driven by `activity`.
