import { useState } from "react";
import { BookOpen, Bot, Gamepad2, Users } from "lucide-react";
import { isNativeApp } from "../platform";
import {
  BOARD_SIZE,
  type GameRules,
  type GameState,
  type Piece,
  createInitialState,
  getPieceAt,
  isDarkSquare
} from "../game";
import { Modal } from "./Modal";
import { PieceToken } from "./PieceToken";

const rows = Array.from({ length: BOARD_SIZE }, (_, row) => row);
const cols = Array.from({ length: BOARD_SIZE }, (_, col) => col);
const previewState = createPreviewState();

type HomePageProps = {
  onStartLocal: (rules: GameRules) => void;
  onOpenMultiplayer: () => void;
};

type HomeDialog = "new-game" | "rules" | "bots" | null;

export function HomePage({ onStartLocal, onOpenMultiplayer }: HomePageProps) {
  const [dialog, setDialog] = useState<HomeDialog>(null);
  const [forceCheckerCaptures, setForceCheckerCaptures] = useState(true);

  function beginLocalGame() {
    onStartLocal({ forceCheckerCaptures });
  }

  return (
    <main className="home-page">
      <div className="home-game-scene" aria-hidden="true">
        <div className="preview-shell">
          <div className="preview-player preview-opponent">
            <span className="preview-avatar">P2</span>
            <span>Player 2</span>
            <small>1200</small>
          </div>
          <PreviewBoard state={previewState} />
          <div className="preview-player preview-you">
            <span className="preview-avatar">P1</span>
            <span>Player 1</span>
            <small>1200</small>
          </div>
        </div>
      </div>
      <div className="home-shade" aria-hidden="true" />

      <section className="home-menu" aria-labelledby="home-title">
        <p className="home-kicker">A checkers variant with one bad idea</p>
        <h1 id="home-title">Knight Checkers</h1>
        <p className="home-summary">
          Classic checkers, plus one elusive knight that only moves every other turn.
        </p>

        <div className="home-actions" aria-label="Game modes">
          <button className="menu-button primary" type="button" onClick={() => setDialog("new-game")}>
            <Gamepad2 aria-hidden="true" size={23} />
            <span>
              <strong>Pass &amp; Play</strong>
              <small>Two players, one screen</small>
            </span>
          </button>
          <button className="menu-button" type="button" onClick={onOpenMultiplayer}>
            <Users aria-hidden="true" size={23} />
            <span>
              <strong>Play Multiplayer</strong>
              <small>Rooms and matchmaking</small>
            </span>
          </button>
          {/* App review rejects placeholder features, so the unbuilt bot mode stays web-only. */}
          {isNativeApp ? null : (
            <button className="menu-button quiet" type="button" onClick={() => setDialog("bots")}>
              <Bot aria-hidden="true" size={23} />
              <span>
                <strong>Play a Bot</strong>
                <small>Practice on your own</small>
              </span>
            </button>
          )}
        </div>

        <button className="rules-link" type="button" onClick={() => setDialog("rules")}>
          <BookOpen aria-hidden="true" size={18} />
          How to play
        </button>
      </section>

      {dialog === "new-game" ? (
        <Modal
          title="Start a local game"
          description="Choose the capture rule for this match. Knights are never forced to capture."
          onClose={() => setDialog(null)}
        >
          <label className="setting-toggle">
            <span>
              <strong>Force checker captures</strong>
              <small>When a checker can jump, it must.</small>
            </span>
            <input
              type="checkbox"
              checked={forceCheckerCaptures}
              onChange={(event) => setForceCheckerCaptures(event.currentTarget.checked)}
            />
            <span className="toggle-track" aria-hidden="true" />
          </label>
          <div className="modal-actions">
            <button className="button secondary" type="button" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button className="button primary" type="button" data-autofocus onClick={beginLocalGame}>
              Start game
            </button>
          </div>
        </Modal>
      ) : null}

      {dialog === "rules" ? (
        <Modal title="How to play" onClose={() => setDialog(null)}>
          <p className="rules-copy">
            Play normal checkers: move diagonally, jump enemy pieces, chain jumps, and crown pieces on
            the far row. Each player also has a knight that moves and captures like a chess knight. A
            knight rests for its owner&apos;s next turn after moving and is never forced to capture. Win by
            taking every enemy checker; the knight does not have to be caught.
          </p>
          <div className="modal-actions single-action">
            <button className="button primary" type="button" data-autofocus onClick={() => setDialog(null)}>
              Got it
            </button>
          </div>
        </Modal>
      ) : null}

      {dialog === "bots" ? (
        <Modal
          title="Bots are not available yet"
          description="Computer opponents are planned, but this version is focused on local play."
          onClose={() => setDialog(null)}
        >
          <div className="modal-actions single-action">
            <button className="button primary" type="button" data-autofocus onClick={() => setDialog(null)}>
              Back to menu
            </button>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}

function PreviewBoard({ state }: { state: GameState }) {
  return (
    <div className="preview-board" role="presentation">
      {rows.flatMap((row) =>
        cols.map((col) => {
          const square = { row, col };
          const piece = getPieceAt(state, square);
          return (
            <span
              className={`preview-square ${isDarkSquare(square) ? "dark-square" : "light-square"}`}
              key={`${row}-${col}`}
            >
              {piece ? (
                <PieceToken piece={piece} resting={piece.kind === "knight" && state.knightCooldown[piece.player] > 0} />
              ) : null}
            </span>
          );
        })
      )}
    </div>
  );
}

function createPreviewState() {
  const state = createInitialState({ forceCheckerCaptures: true });
  const board = Array.from({ length: BOARD_SIZE }, () =>
    Array<Piece | null>(BOARD_SIZE).fill(null)
  );
  const pieces: Array<[Piece, number, number]> = [
    [{ id: "preview-black-1", player: "black", kind: "man" }, 0, 1],
    [{ id: "preview-black-2", player: "black", kind: "man" }, 0, 5],
    [{ id: "preview-black-3", player: "black", kind: "man" }, 1, 0],
    [{ id: "preview-black-4", player: "black", kind: "man" }, 1, 4],
    [{ id: "preview-black-5", player: "black", kind: "king" }, 3, 2],
    [{ id: "preview-black-6", player: "black", kind: "man" }, 2, 7],
    [{ id: "black-knight", player: "black", kind: "knight" }, 2, 3],
    [{ id: "preview-red-1", player: "red", kind: "man" }, 5, 0],
    [{ id: "preview-red-2", player: "red", kind: "man" }, 5, 2],
    [{ id: "preview-red-3", player: "red", kind: "man" }, 5, 6],
    [{ id: "preview-red-4", player: "red", kind: "man" }, 6, 1],
    [{ id: "preview-red-5", player: "red", kind: "king" }, 4, 5],
    [{ id: "preview-red-6", player: "red", kind: "man" }, 6, 7],
    // Knights can occupy light squares; checkers can never reach this red knight on e4.
    [{ id: "red-knight", player: "red", kind: "knight" }, 4, 4]
  ];

  for (const [piece, row, col] of pieces) {
    board[row][col] = piece;
  }

  return {
    ...state,
    board,
    currentPlayer: "black" as const,
    knightCooldown: { red: 0, black: 0 },
    turnNumber: 15,
    status: {
      phase: "playing" as const,
      message: "Black to move"
    }
  };
}
