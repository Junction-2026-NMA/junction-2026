# Brand work migration — 13 November 2026

Canonical repository: https://github.com/Junction-2026-NMA/junction-2026

## Branches

- `main`: the team's existing Sisu app, finance engine, datasets and shared build context. Preserved by this migration.
- `brand-kit`: the complete committed Sisu brand and UI reference, with its original Git history. Read `AGENTS.md` before using it; build product features on other branches.
- `archive/s-banking-main`: the former `riripatate/s-banking` main, including its original merge history.
- `wip/brand-assets-2026-11-13`: a snapshot of the latest project files plus this continuation note. The latest committed asset work is also on `brand-kit`. This snapshot does not approve the artwork.
- `archive/wip-before-migration`: the original working state from the start of this transfer, including 18 hidden QA previews removed by the asset session during migration.

## Continue the asset work

Start with `moodboard/updated-board.html`, `brand/08-liito-character-spec.md`, `brand/07-image-prompts.md`, and `moodboard/generated/README.md`. The generation log records attempts and remaining defects. All images are draft concept references: tonal texture, palette drift, aspect-ratio issues and exact seamlessness still need review. The existing manifest is historical metadata and is not a complete inventory of the new files.

The asset session committed its latest set and board during migration (`0b58ea220fb93bd1dc0f19178afb23567ef57065`); this branch includes that commit. The earlier in-progress snapshot is retained as a parent, and the original QA previews are on `archive/wip-before-migration`. The local directory and session records stay intact. `origin` now points to this organization repository so subsequent ordinary pushes go here. Later edits need their own commit and push. Review remaining image acceptance defects before treating the concepts as production masters; this migration does not complete that design review.

## Other project records

Original repository (kept intact): https://github.com/riripatate/s-banking. Its existing merged PR and historical discussion remain there; branches preserve the underlying commits. The destination team's existing PR is also preserved. No PR was merged by this migration.

Older Google Doc copy: https://docs.google.com/document/d/1oAlh40dRMHmywMyTKtX9tk8AiOq8mK-F0QXBKM5FgTs/edit. It still contains the older Hillo name and v0.1 palette; Git is the source of truth. The Doc is linked, not copied or updated by migration.

Personal chat archives and private Obsidian notes remain in their existing stores. This public repository contains the project files and this continuation handoff, not private account history or credentials.
