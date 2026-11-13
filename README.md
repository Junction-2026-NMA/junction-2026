# Sisu

"Your bank knows your past. Sisu helps change your future." A mobile-first financial coach built on the Junction 2026 S-Pankki synthetic dataset.

## Run it
```bash
npm install
npm run dev
```
Open http://localhost:3000. The reduced demo data is already in `data/`, so no dataset download is needed.

## What works today
- Three curated synthetic customers (names invented).
- X-ray: safe-to-spend with the maths shown, three S-Pankki baskets with peer comparison, recurring bills with confidence, month-by-month cash flow.
- Every figure opens the transactions behind it.

See `CLAUDE.md` for priorities, rules and who owns which folder. The API contract is `lib/types.ts`.
