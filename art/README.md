# Piece Art

Original knight and crown sprites for Knight Checkers, rendered from 3D models rather than drawn by hand.

- `shapes.mjs`: the knight outline and crown shapes, designed for this project. Every style shares them.
- `studio.html` / `studio.js`: three.js scene that extrudes the outlines into 3D pieces, lights them like a product photo and renders 512px PNGs for five styles (lacquer, wood, toon, faceted, metal). Each knight comes in red, black and gray (resting).
- `save-server.mjs`: tiny local endpoint the studio posts its PNGs to (`art/out/`).
- `export.mjs`: trims and resizes the renders into `src/assets/pieces/<style>/`.
- `contact-sheet.mjs`, `board-preview.html`: review tools. `piece-sets.png` and `icon-candidates.png` record the five styles Zach chose from on 2026-10-17.

## Re-rendering

```bash
node art/save-server.mjs
npm run dev:local
```

Open `http://127.0.0.1:4174/art/studio.html` (add `?style=lacquer` for one style, `&save=0` to preview without saving), then run `node art/export.mjs`.

## Shipped set

Lacquered resin knights with a plain gold crown (no jewels), chosen by Zach on 2026-10-17. `node art/export.mjs [style]` copies a style into `src/assets/pieces/`. The other styles stay in the studio for later use.
