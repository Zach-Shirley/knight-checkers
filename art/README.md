# Piece Art

Original knight and crown sprites for Knight Checkers, rendered from 3D models rather than drawn by hand.

- `shapes.mjs`: the knight outline and crown shapes, designed for this project. Every style shares them.
- `studio.html` / `studio.js`: three.js scene that extrudes the outlines into 3D pieces, lights them like a product photo and renders 512px PNGs for five styles (lacquer, wood, toon, faceted, metal). Each knight comes in red, black and gray (resting).
- `save-server.mjs`: tiny local endpoint the studio posts its PNGs to (`art/out/`).
- `export.mjs`: trims and resizes the renders into `src/assets/pieces/<style>/`.
- `contact-sheet.mjs`, `board-preview.html`, `compare.mjs`: review tools. `piece-sets.png` is the latest side-by-side comparison on the real board.

## Re-rendering

```bash
node art/save-server.mjs
npm run dev:local
```

Open `http://127.0.0.1:4174/art/studio.html` (add `?style=wood` for one style, `&save=0` to preview without saving), then run `node art/export.mjs` and `node art/compare.mjs`.

## Using a set in the app

`src/pieceArt.ts` picks the set. Add `?pieces=<style>` to any app URL to preview one; the choice sticks on that device. `classic` is the original Wikimedia-based art (CC BY-SA 3.0) and is still the default until a set is chosen.
