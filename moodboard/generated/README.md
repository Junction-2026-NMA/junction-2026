# Sisu concept artwork

Generated 13 November 2026 with the built-in imagegen tool. These PNGs are review drafts. The character master still needs team selection and a clean vector redraw for production.

| File | Size | Use |
|---|---|---|
| `liito-master-sheet.png` | 1536 × 1024 | Five views: front, three-quarter, side, back, membrane open. |
| `liito-moods.png` | 1774 × 887 | Eight effort/context states, in four columns and two rows. |
| `liito-glide.png` | 1254 × 1254, RGBA | Transparent signature pose, with a cleanup pass. |
| `mood-forest-pantry.png` | 1672 × 941 | Forest, berries and savings jars; no mascot. |

The mood grid and glide use the five-view sheet as a visual reference. Character colours follow the current identity: grey fur, pale face, S-green membrane and mint cheek accents. The three mascot neutrals remain confined to Liito.

- [Visual board](../updated-board.html) and [PNG export](../style-board-v02.png).
- [Character specification](../../brand/08-liito-character-spec.md).
- [Exact generation and cleanup prompts](../generation-prompts-v02.md).
- [Asset manifest](manifest.json).

The four `*-fill.svg` icons come from [Phosphor Icons](https://github.com/phosphor-icons/core/tree/main/assets/fill). They are inlined in the board and retain their [MIT license](PHOSPHOR-LICENSE.txt). They are not generated character assets.

Illustrations are raster concepts. Small edge artifacts and colour interpolation need correction in the production vector redraw; these files do not establish exact vector paths or an approved animation rig.

## Generation log

Sisu asset completion, 2026-11-13. Built-in imagegen; no git commands. All edits are confined to this directory. The preceding README and manifest are historical metadata and retain the old spelling; the current product name is **Sisu**. The manifest is preserved and is not a current inventory.

Prompts use the exact style block from `brand/07-image-prompts.md`, plus its exact character block wherever Liito appears. The selected `liito-master-sheet.png` is attached to every subsequent Liito generation and repair. Images were opened after each attempt. The original mascot PNGs and extra forest-pantry PNG failed flat-fill checks; SVG icons and supporting files are preserved.

**Status convention:** generated means a PNG was produced and saved. Remaining defects below are acceptance failures, not approved exceptions. After at most three attempts, the closest result is retained as requested. Strict flat-palette acceptance is not claimed: the tool retains tonal texture and colour drift within fills, confirmed by pixel inspection of the master background.

| File | Status | Attempts this session | Selected attempt | Remaining defect / check |
|---|---|---:|---:|---|
| `liito-master-sheet.png` | generated | 3 | 1 | Faint interior tonal texture and colour drift remain. Attempt 1 best preserves the broad back tail and original construction. |
| `liito-moods.png` | generated | 3 | 2 | Subtle shading and colour drift remain. Focused expression corrected to calm open eyes; eight poses and 4-by-2 layout present. |
| `liito-glide.png` | generated | 3 | 3 | Subtle shading and colour drift remain. S-green opaque background and dark-green membrane use the explicit A3 exception; three mint berries present. |
| `app-icon.png` | generated | 3 | 3 | Subtle shading and colour drift remain; face fills more than 70 percent and ears sit below the top edge. Face-only square remains readable. |
| `jar-states.png` | generated | 3 | 3 | Tonal texture/colour drift remain. Output 3:1 rather than requested 4:1; glass edge is visually an outline despite no-stroke instruction. |
| `shelf.png` | generated | 3 | 3 | Tonal texture/colour drift remain; second jar content is darker than S green despite repair. Five jars, varied levels and empty dashed slot present. |
| `basket-icons.png` | generated | 3 | 3 | Tonal texture/colour drift remain. Output 3:1 rather than requested 4:1; jar edge is thicker than requested. |
| `receipt-blank.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. Bars remain horizontal rather than tilting with the paper; pale-green bars used to avoid adding an unlisted grey. |
| `stickers.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. |
| `berries-flame.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. |
| `mood-forest-floor.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. Soft-green backing added behind dark spruce to keep it visible on dark ground. |
| `mood-pantry.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. |
| `mood-payday-glide.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. Uses the explicit C3 dark-membrane exception; unwanted rim removed. |
| `mood-tight-week.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. |
| `mood-celebration.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. |
| `mood-pattern.png` | generated | 3 | 3 | Subtle shading and colour drift remain after three attempts. Clipped motifs removed; background edge pixels still vary, so exact seamlessness is not established. |
