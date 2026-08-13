# Knight Checkers

A local two-player variant of American checkers with one chess knight per side.

## Run locally

```bash
npm install
npm run dev
```

Then open the localhost URL printed by Vite.

For the dedicated side-project local URL:

```bash
npm run dev:local
```

Then open `http://knight-checkers.127.0.0.1.sslip.io:4174/` or `http://127.0.0.1:4174/`.

## Implemented rules

- Standard 8x8 checkers movement on dark squares.
- Optional forced-capture toggle for checker pieces.
- With forced checker captures on, checker captures and multi-jumps are mandatory, but knight moves are still optional.
- With forced checker captures off, no pieces are forced to capture.
- Men crown into kings on the far row.
- Each side starts with the normal 12 checkers plus one adjacent second-rank knight: Red on e2, Black on d7.
- The knight moves and captures like a chess knight and is never forced to capture.
- After a knight moves, that player's next turn must be a non-knight move before the knight is ready again.
- Checkers can jump and capture the knight like any other opposing piece.
- A player wins when the opponent has no men or kings left; the opponent's knight can remain on the board.
- A player also loses if they have no legal move, matching normal checkers lockout behavior.

The game rules live in `src/game.ts`, separate from the React UI, so a later online version can reuse the same state transitions behind a network layer.

## Asset attribution

- Knight SVGs are based on `Chess ndt45.svg` and `Chess nlt45.svg` from Wikimedia Commons' standard transparent chess pieces, authored by Cburnett and licensed CC BY-SA 3.0. The red knight is a local color derivative of the light SVG.
