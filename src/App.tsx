import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Undo2 } from "lucide-react";
import {
  BOARD_SIZE,
  Move,
  Piece,
  PieceKind,
  Player,
  Square,
  applyMove,
  createInitialState,
  endOptionalJump,
  getLegalMoves,
  getPieceAt,
  getPieceCounts,
  isDarkSquare,
  pieceName,
  playerName,
  squareName,
  updateGameRules
} from "./game";
import knightBlackSvg from "./assets/chess-knight-black.svg";
import knightRedSvg from "./assets/chess-knight-red.svg";

const rows = Array.from({ length: BOARD_SIZE }, (_, row) => row);
const cols = Array.from({ length: BOARD_SIZE }, (_, col) => col);
const CELL_DISTANCE_IN_TOKEN_PERCENT = 138.889;

type PieceAnimation = {
  id: number;
  pieceId: string;
  mode: "slide" | "hop";
  style: CSSProperties & {
    "--move-from-x": string;
    "--move-from-y": string;
  };
};

export function App() {
  const [history, setHistory] = useState(() => [createInitialState()]);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [pieceAnimation, setPieceAnimation] = useState<PieceAnimation | null>(null);
  const state = history[history.length - 1];
  const counts = useMemo(() => getPieceCounts(state), [state]);
  const legalMoves = useMemo(() => getLegalMoves(state), [state]);
  const hasForcedCheckerCapture =
    state.rules.forceCheckerCaptures &&
    legalMoves.some((move) => move.pieceKind !== "knight" && move.captures.length > 0);
  const movesByPiece = useMemo(() => groupMovesByPiece(legalMoves), [legalMoves]);
  const selectedMoves = selectedPieceId ? movesByPiece.get(selectedPieceId) ?? [] : [];

  useEffect(() => {
    if (state.forcedPieceId) {
      setSelectedPieceId(state.forcedPieceId);
      return;
    }

    if (selectedPieceId && !movesByPiece.has(selectedPieceId)) {
      setSelectedPieceId(null);
    }
  }, [movesByPiece, selectedPieceId, state.forcedPieceId]);

  function playMove(move: Move) {
    const nextState = applyMove(state, move.id);
    setPieceAnimation(createPieceAnimation(move, state.turnNumber));
    setHistory((currentHistory) => [...currentHistory, nextState]);
    setSelectedPieceId(nextState.forcedPieceId);
  }

  function handleSquareClick(square: Square) {
    if (state.status.phase === "won") {
      return;
    }

    const destinationMove = selectedMoves.find(
      (move) => move.to.row === square.row && move.to.col === square.col
    );

    if (destinationMove) {
      playMove(destinationMove);
      return;
    }

    const piece = getPieceAt(state, square);
    if (piece?.player === state.currentPlayer && movesByPiece.has(piece.id)) {
      setSelectedPieceId(piece.id);
      return;
    }

    if (!state.forcedPieceId) {
      setSelectedPieceId(null);
    }
  }

  function resetGame() {
    setHistory([createInitialState(state.rules)]);
    setSelectedPieceId(null);
    setPieceAnimation(null);
  }

  function undoMove() {
    setHistory((currentHistory) => {
      if (currentHistory.length <= 1) {
        return currentHistory;
      }

      const currentRules = currentHistory[currentHistory.length - 1].rules;
      const previousState = updateGameRules(currentHistory[currentHistory.length - 2], currentRules);

      return [...currentHistory.slice(0, currentHistory.length - 2), previousState];
    });
    setSelectedPieceId(null);
    setPieceAnimation(null);
  }

  function setForceCheckerCaptures(forceCheckerCaptures: boolean) {
    setHistory((currentHistory) => {
      const currentState = currentHistory[currentHistory.length - 1];
      const nextState = updateGameRules(currentState, {
        ...currentState.rules,
        forceCheckerCaptures
      });

      return [...currentHistory.slice(0, currentHistory.length - 1), nextState];
    });
    setSelectedPieceId(null);
    setPieceAnimation(null);
  }

  function endJumpTurn() {
    const nextState = endOptionalJump(state);
    setHistory((currentHistory) => [...currentHistory, nextState]);
    setSelectedPieceId(null);
    setPieceAnimation(null);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local two-player variant</p>
          <h1>Knight Checkers</h1>
        </div>
        <div className="topbar-actions">
          <button className="tool-button" type="button" onClick={undoMove} disabled={history.length <= 1}>
            <Undo2 aria-hidden="true" size={18} />
            Undo
          </button>
          <button className="tool-button primary" type="button" onClick={resetGame}>
            <RotateCcw aria-hidden="true" size={18} />
            Reset
          </button>
        </div>
      </header>

      <section className="game-layout">
        <div className="board-stage">
          <div className="board-frame">
            <div className="board" role="grid" aria-label="Knight Checkers board">
              {rows.map((row) =>
                cols.map((col) => {
                  const square = { row, col };
                  const piece = getPieceAt(state, square);
                  const squareMove = selectedMoves.find(
                    (move) => move.to.row === row && move.to.col === col
                  );
                  const isSelected = selectedPieceId === piece?.id;
                  const isPlayablePiece = Boolean(piece && movesByPiece.has(piece.id));
                  const isForcedPiece = state.forcedPieceId === piece?.id;

                  return (
                    <button
                      className={[
                        "square",
                        isDarkSquare(square) ? "dark-square" : "light-square",
                        squareMove ? "legal-square" : "",
                        squareMove?.captures.length ? "capture-square" : "",
                        isSelected ? "selected-square" : "",
                        isPlayablePiece ? "playable-piece-square" : "",
                        isForcedPiece ? "forced-piece-square" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={`${row}-${col}`}
                      type="button"
                      role="gridcell"
                      aria-label={squareAriaLabel(square, piece, squareMove)}
                      onClick={() => handleSquareClick(square)}
                    >
                      {piece ? (
                        <PieceToken
                          piece={piece}
                          animation={pieceAnimation?.pieceId === piece.id ? pieceAnimation : null}
                          onAnimationEnd={(animationId) =>
                            setPieceAnimation((currentAnimation) =>
                              currentAnimation?.id === animationId ? null : currentAnimation
                            )
                          }
                        />
                      ) : null}
                      {squareMove ? <span className="move-target" aria-hidden="true" /> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <aside className="side-panel" aria-label="Game status">
          <section className="status-panel">
            <div className="turn-row">
              <span className={`player-dot ${state.currentPlayer}`} aria-hidden="true" />
              <div>
                <p className="label">Turn</p>
                <h2>{state.status.phase === "won" ? state.status.message : playerName(state.currentPlayer)}</h2>
              </div>
            </div>
            {state.status.phase === "playing" ? (
              <p className="state-note">
                {state.forcedPieceId && state.canEndJump
                  ? "Continue the jump or end your turn."
                  : state.forcedPieceId
                    ? "Finish the checker jump."
                  : hasForcedCheckerCapture
                    ? "Checker capture required; knight stays optional."
                    : "Choose a legal piece."}
              </p>
            ) : (
              <p className="state-note winner-note">{playerName(state.status.winner)} controls the board.</p>
            )}
            {state.canEndJump ? (
              <button className="end-jump-button" type="button" onClick={endJumpTurn}>
                End turn
              </button>
            ) : null}
          </section>

          <section className="rules-panel">
            <label className="toggle-row">
              <span>
                <strong>Forced checker captures</strong>
                <small>Knights are never forced to take.</small>
              </span>
              <input
                type="checkbox"
                checked={state.rules.forceCheckerCaptures}
                disabled={Boolean(state.forcedPieceId)}
                onChange={(event) => setForceCheckerCaptures(event.currentTarget.checked)}
              />
              <span className="toggle-switch" aria-hidden="true" />
            </label>
          </section>

          <section className="score-panel">
            <PlayerScore player="red" counts={counts.red} cooldown={state.knightCooldown.red} />
            <PlayerScore player="black" counts={counts.black} cooldown={state.knightCooldown.black} />
          </section>

          <section className="move-log-panel">
            <div className="panel-heading">
              <p className="label">Moves</p>
              <span>{state.moveLog.length}</span>
            </div>
            <ol className="move-log">
              {state.moveLog.length === 0 ? (
                <li className="empty-log">No moves yet</li>
              ) : (
                state.moveLog
                  .slice()
                  .reverse()
                  .map((entry, index) => (
                    <li key={`${entry.turn}-${index}`}>
                      <span>{entry.turn}</span>
                      <p>{entry.notation}</p>
                    </li>
                  ))
              )}
            </ol>
          </section>
        </aside>
      </section>

      <section className="instructions-panel" aria-label="Quick instructions">
        <div>
          <p className="label">Quick instructions</p>
          <h2>Rules at a glance</h2>
        </div>
        <ul>
          <li>Click one of your highlighted pieces, then click a highlighted destination.</li>
          <li>Checkers move diagonally, jump diagonally, can chain jumps when available, and crown on the back row.</li>
          <li>When forced captures are off, chained jumps are optional and can be ended after any jump.</li>
          <li>Knights move and capture like chess knights, rest for your next turn after moving, and can be jumped by checkers.</li>
          <li>The knight never has a forced capture. The toggle only controls whether checker captures are mandatory.</li>
          <li>Win by taking every enemy checker or king. The enemy knight can survive.</li>
        </ul>
      </section>
    </main>
  );
}

function PlayerScore({
  player,
  counts,
  cooldown
}: {
  player: Player;
  counts: ReturnType<typeof getPieceCounts>[Player];
  cooldown: number;
}) {
  const knightState = counts.knights === 0 ? "captured" : cooldown > 0 ? "resting" : "ready";

  return (
    <div className={`player-score ${player}`}>
      <div className="score-title">
        <span className={`player-dot ${player}`} aria-hidden="true" />
        <strong>{playerName(player)}</strong>
      </div>
      <div className="score-grid">
        <span>
          <b>{counts.checkers}</b>
          checkers
        </span>
        <span>
          <b>{counts.kings}</b>
          kings
        </span>
        <span>
          <b>{counts.knights}</b>
          knight
        </span>
      </div>
      <p className={`knight-state ${knightState}`}>Knight {knightState}</p>
    </div>
  );
}

function PieceToken({
  piece,
  animation,
  onAnimationEnd
}: {
  piece: Piece;
  animation: PieceAnimation | null;
  onAnimationEnd: (animationId: number) => void;
}) {
  const animationClass = animation ? `animate-${animation.mode}` : "";
  const handleAnimationEnd = () => {
    if (animation) onAnimationEnd(animation.id);
  };

  if (piece.kind === "knight") {
    return (
      <span
        className={`knight-piece ${piece.player} ${animationClass}`.trim()}
        style={animation?.style}
        aria-hidden="true"
        onAnimationEnd={handleAnimationEnd}
      >
        <img
          className="knight-mark"
          src={piece.player === "red" ? knightRedSvg : knightBlackSvg}
          alt=""
          draggable="false"
        />
      </span>
    );
  }

  return (
    <span
      className={`piece-token ${piece.player} ${piece.kind} ${animationClass}`.trim()}
      style={animation?.style}
      aria-hidden="true"
      onAnimationEnd={handleAnimationEnd}
    >
      {piece.kind === "king" ? <CrownMark /> : null}
    </span>
  );
}

function CrownMark() {
  return (
    <svg className="crown-mark" viewBox="0 0 32 24" focusable="false" aria-hidden="true">
      <path d="M2,21 L2,11 L5,8 L8,14 L11,8 L14,14 L17,8 L20,14 L23,8 L26,14 L30,11 L30,21 Z" />
      <rect x="2" y="21" width="28" height="3" rx="1" />
    </svg>
  );
}

function createPieceAnimation(move: Move, turnNumber: number): PieceAnimation {
  const fromX = (move.from.col - move.to.col) * CELL_DISTANCE_IN_TOKEN_PERCENT;
  const fromY = (move.from.row - move.to.row) * CELL_DISTANCE_IN_TOKEN_PERCENT;
  const isHop = move.pieceKind === "knight" || move.captures.length > 0;

  return {
    id: turnNumber,
    pieceId: move.pieceId,
    mode: isHop ? "hop" : "slide",
    style: {
      "--move-from-x": `${fromX}%`,
      "--move-from-y": `${fromY}%`
    }
  };
}

function groupMovesByPiece(moves: Move[]) {
  const grouped = new Map<string, Move[]>();

  for (const move of moves) {
    const existingMoves = grouped.get(move.pieceId) ?? [];
    existingMoves.push(move);
    grouped.set(move.pieceId, existingMoves);
  }

  return grouped;
}

function squareAriaLabel(square: Square, piece: Piece | null, move: Move | undefined) {
  const contents = piece ? `${playerName(piece.player)} ${pieceName(piece.kind)}` : "empty";
  const moveText = move
    ? move.captures.length > 0
      ? ", capture destination"
      : ", legal destination"
    : "";

  return `${squareName(square)}, ${contents}${moveText}`;
}
