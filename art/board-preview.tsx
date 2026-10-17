// A fixed mid-game position for judging piece art in the real board styles.
// Open /art/board-preview.html.
import ReactDOM from "react-dom/client";
import { PieceToken } from "../src/components/PieceToken";
import type { Piece, PieceKind, Player } from "../src/game";
import "../src/styles.css";

type Placed = { square: string; player: Player; kind: PieceKind; resting?: boolean };

const POSITION: Placed[] = [
  { square: "b8", player: "black", kind: "man" },
  { square: "f8", player: "black", kind: "man" },
  { square: "h8", player: "black", kind: "man" },
  { square: "c7", player: "black", kind: "man" },
  { square: "e7", player: "black", kind: "knight" },
  { square: "d6", player: "black", kind: "man" },
  { square: "h6", player: "black", kind: "king" },
  { square: "e5", player: "red", kind: "king" },
  { square: "b4", player: "black", kind: "king" },
  { square: "f4", player: "red", kind: "man" },
  { square: "c3", player: "red", kind: "knight", resting: true },
  { square: "g3", player: "red", kind: "man" },
  { square: "b2", player: "red", kind: "man" },
  { square: "d2", player: "red", kind: "king" },
  { square: "f2", player: "red", kind: "knight" },
  { square: "a1", player: "red", kind: "man" },
  { square: "e1", player: "red", kind: "man" }
];

const placed = new Map(POSITION.map((p) => [p.square, p]));

function Board() {
  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const name = `${String.fromCharCode(97 + col)}${8 - row}`;
      const entry = placed.get(name);
      const piece: Piece | null = entry ? { id: name, player: entry.player, kind: entry.kind } : null;
      squares.push(
        <div key={name} className={`square ${(row + col) % 2 ? "dark-square" : "light-square"}`}>
          {piece ? <PieceToken piece={piece} resting={entry?.resting} /> : null}
        </div>
      );
    }
  }
  return (
    <main className="game-page" style={{ display: "grid", placeItems: "center" }}>
      <div className="board-frame" style={{ width: "min(92vw, 640px)" }}>
        <div className="board">{squares}</div>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<Board />);
