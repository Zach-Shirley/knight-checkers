import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Bot,
  BookOpen,
  Home,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Undo2,
  UserRound
} from "lucide-react";
import {
  BOARD_SIZE,
  type GameRules,
  type Move,
  type Piece,
  type Player,
  type Square,
  applyMove,
  createInitialState,
  endOptionalJump,
  getLegalMoves,
  getPieceAt,
  isDarkSquare,
  opponentOf,
  pieceName,
  playerName,
  squareName,
  updateGameRules
} from "../game";
import { BOT_LEVELS, type BotLevel } from "../bot";
import { requestBotAction } from "../botClient";
import { getPlayerIdentity } from "../playerIdentity";
import { Modal } from "./Modal";
import { PieceToken, type PieceAnimation } from "./PieceToken";

const rows = Array.from({ length: BOARD_SIZE }, (_, row) => row);
const cols = Array.from({ length: BOARD_SIZE }, (_, col) => col);
const CELL_DISTANCE_IN_TOKEN_PERCENT = 138.889;

type GameDialog = "new-game" | "settings" | "rules" | null;

// Pause before the bot moves so its reply reads as a move, not a flicker.
const BOT_MIN_THINK_MS = 650;

export type BotOpponent = { player: Player; level: BotLevel };

type LocalGamePageProps = {
  initialRules: GameRules;
  onExit: () => void;
  // Without a bot this is pass-and-play.
  bot?: BotOpponent;
  // Replaces the panel's "Pass & play" / "Vs bot" label, e.g. while a quick match is searching.
  kicker?: string;
};

export function LocalGamePage({ initialRules, onExit, bot, kicker }: LocalGamePageProps) {
  const [history, setHistory] = useState(() => [createInitialState(initialRules)]);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [pieceAnimation, setPieceAnimation] = useState<PieceAnimation | null>(null);
  const [dialog, setDialog] = useState<GameDialog>(null);
  const [ruleDraft, setRuleDraft] = useState(initialRules.forceCheckerCaptures);
  const state = history[history.length - 1];
  const legalMoves = useMemo(() => getLegalMoves(state), [state]);
  const movesByPiece = useMemo(() => groupMovesByPiece(legalMoves), [legalMoves]);
  const selectedMoves = selectedPieceId ? movesByPiece.get(selectedPieceId) ?? [] : [];
  const hasForcedCheckerCapture =
    state.rules.forceCheckerCaptures &&
    legalMoves.some((move) => move.pieceKind !== "knight" && move.captures.length > 0);
  const humanPlayer = bot ? opponentOf(bot.player) : null;
  const isBotTurn = Boolean(bot && state.status.phase === "playing" && state.currentPlayer === bot.player);

  useEffect(() => {
    if (!bot || !isBotTurn) return;
    let cancelled = false;
    const started = performance.now();
    requestBotAction(state, bot.level).then((action) => {
      const wait = Math.max(0, BOT_MIN_THINK_MS - (performance.now() - started));
      window.setTimeout(() => {
        if (cancelled || !action) return;
        if (action.type === "end-jump") {
          endJumpTurn();
          return;
        }
        const move = legalMoves.find((candidate) => candidate.id === action.moveId);
        if (move) playMove(move);
      }, wait);
    });
    return () => {
      cancelled = true;
    };
    // playMove/endJumpTurn only read `state`, which is a dependency.
  }, [bot, isBotTurn, state, legalMoves]);

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
    if (state.status.phase === "won" || isBotTurn) return;

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

    if (!state.forcedPieceId) setSelectedPieceId(null);
  }

  function undoMove() {
    setHistory((currentHistory) => {
      if (currentHistory.length <= 1) return currentHistory;

      const currentRules = currentHistory[currentHistory.length - 1].rules;
      let target = currentHistory.length - 2;
      // Against a bot, step back past its reply to the start of the human's last turn.
      if (humanPlayer) {
        while (target > 0 && (currentHistory[target].currentPlayer !== humanPlayer || currentHistory[target].forcedPieceId)) {
          target--;
        }
      }
      const previousState = updateGameRules(currentHistory[target], currentRules);
      return [...currentHistory.slice(0, target), previousState];
    });
    setSelectedPieceId(null);
    setPieceAnimation(null);
  }

  function startNewGame() {
    setHistory([createInitialState({ forceCheckerCaptures: ruleDraft })]);
    setSelectedPieceId(null);
    setPieceAnimation(null);
    setDialog(null);
  }

  function saveSettings() {
    setHistory((currentHistory) => {
      const currentState = currentHistory[currentHistory.length - 1];
      const nextState = updateGameRules(currentState, { forceCheckerCaptures: ruleDraft });
      return [...currentHistory.slice(0, -1), nextState];
    });
    setSelectedPieceId(null);
    setPieceAnimation(null);
    setDialog(null);
  }

  function openDialog(nextDialog: GameDialog) {
    setRuleDraft(state.rules.forceCheckerCaptures);
    setDialog(nextDialog);
  }

  function endJumpTurn() {
    const nextState = endOptionalJump(state);
    setHistory((currentHistory) => [...currentHistory, nextState]);
    setSelectedPieceId(null);
    setPieceAnimation(null);
  }

  const stateMessage = isBotTurn ? "The bot is thinking..." : getStateMessage(state, hasForcedCheckerCapture);
  const botName = bot ? `${BOT_LEVELS[bot.level].label} bot` : null;

  return (
    <main className="game-page">
      <section className="game-workspace" aria-label="Local Knight Checkers game">
        <div className="board-column">
          <PlayerBar
            name={botName ?? "Player 2"}
            player="black"
            active={state.status.phase === "playing" && state.currentPlayer === "black"}
            isBot={Boolean(bot)}
          />

          <div className="board-frame">
            <div className="board" role="grid" aria-label="Knight Checkers board">
              {rows.flatMap((row) =>
                cols.map((col) => {
                  const square = { row, col };
                  const piece = getPieceAt(state, square);
                  const squareMove = selectedMoves.find(
                    (move) => move.to.row === row && move.to.col === col
                  );
                  const isSelected = selectedPieceId === piece?.id;
                  const isForcedPiece = state.forcedPieceId === piece?.id;
                  const isRestingKnight = Boolean(
                    piece?.kind === "knight" && state.knightCooldown[piece.player] > 0
                  );

                  return (
                    <button
                      className={[
                        "square",
                        isDarkSquare(square) ? "dark-square" : "light-square",
                        squareMove ? "legal-square" : "",
                        squareMove?.captures.length ? "capture-square" : "",
                        isSelected ? "selected-square" : "",
                        isForcedPiece ? "forced-piece-square" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={`${row}-${col}`}
                      type="button"
                      role="gridcell"
                      aria-label={squareAriaLabel(square, piece, squareMove, isRestingKnight)}
                      onClick={() => handleSquareClick(square)}
                    >
                      {piece ? (
                        <PieceToken
                          piece={piece}
                          resting={isRestingKnight}
                          animation={pieceAnimation?.pieceId === piece.id ? pieceAnimation : null}
                          onAnimationEnd={(animationId) =>
                            setPieceAnimation((currentAnimation) =>
                              currentAnimation?.id === animationId ? null : currentAnimation
                            )
                          }
                        />
                      ) : null}
                      {squareMove ? <span className="move-target" aria-hidden="true" /> : null}
                      {col === BOARD_SIZE - 1 ? (
                        <span className="rank-label" aria-hidden="true">{BOARD_SIZE - row}</span>
                      ) : null}
                      {row === BOARD_SIZE - 1 ? (
                        <span className="file-label" aria-hidden="true">{String.fromCharCode(97 + col)}</span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <PlayerBar
            name={bot ? getPlayerIdentity().name : "Player 1"}
            player="red"
            active={state.status.phase === "playing" && state.currentPlayer === "red"}
            isYou
          />
        </div>

        <aside className="game-panel" aria-label="Game controls and move history">
          <header className="game-panel-header">
            <button className="icon-button" type="button" onClick={onExit} aria-label="Return home" title="Home">
              <Home aria-hidden="true" size={20} />
            </button>
            <div>
              <p className="section-kicker">{kicker ?? (bot ? "Vs bot" : "Pass & play")}</p>
              <strong>{botName ?? "Local game"}</strong>
            </div>
            <button
              className="icon-button panel-settings"
              type="button"
              onClick={() => openDialog("settings")}
              aria-label="Game settings"
              title="Settings"
            >
              <Settings aria-hidden="true" size={20} />
            </button>
          </header>

          <section className={`turn-status ${state.status.phase === "won" ? "game-over" : ""}`}>
            <span className={`status-color ${state.status.phase === "won" ? state.status.winner : state.currentPlayer}`} />
            <div>
              <p>{state.status.phase === "won" ? "Game over" : `${playerName(state.currentPlayer)} to move`}</p>
              <span>{stateMessage}</span>
            </div>
            {state.canEndJump && !isBotTurn ? (
              <button className="text-button" type="button" onClick={endJumpTurn}>End turn</button>
            ) : null}
          </section>

          <section className="moves-section" aria-labelledby="moves-title">
            <div className="moves-heading">
              <h2 id="moves-title">Moves</h2>
              <span>{state.moveLog.length}</span>
            </div>
            <ol className="move-list">
              {state.moveLog.length === 0 ? (
                <li className="empty-moves">Moves will appear here.</li>
              ) : (
                state.moveLog.slice().reverse().map((entry, index) => (
                  <li key={`${entry.turn}-${entry.notation}-${index}`}>
                    <span className="move-number">{entry.turn}</span>
                    <span className={`move-player ${entry.player}`} aria-hidden="true" />
                    <span className="move-notation">{entry.notation}</span>
                  </li>
                ))
              )}
            </ol>
          </section>

          <footer className="game-actions">
            <button type="button" onClick={undoMove} disabled={history.length <= 1} title="Undo last move">
              <Undo2 aria-hidden="true" size={19} />
              <span>Undo</span>
            </button>
            <button type="button" onClick={() => openDialog("new-game")} title="Start a new game">
              <RotateCcw aria-hidden="true" size={19} />
              <span>New game</span>
            </button>
            <button type="button" onClick={() => setDialog("rules")} title="View rules">
              <BookOpen aria-hidden="true" size={19} />
              <span>Rules</span>
            </button>
          </footer>
        </aside>
      </section>

      {dialog === "new-game" ? (
        <RuleDialog
          title="Start a new game?"
          description="The current game and move history will be cleared."
          checked={ruleDraft}
          onCheckedChange={setRuleDraft}
          onClose={() => setDialog(null)}
          confirmLabel="Start new game"
          onConfirm={startNewGame}
        />
      ) : null}

      {dialog === "settings" ? (
        <RuleDialog
          title="Game settings"
          description="This setting applies immediately to the current match."
          checked={ruleDraft}
          onCheckedChange={setRuleDraft}
          onClose={() => setDialog(null)}
          confirmLabel="Save settings"
          onConfirm={saveSettings}
          disabled={Boolean(state.forcedPieceId)}
        />
      ) : null}

      {dialog === "rules" ? (
        <Modal title="How to play" onClose={() => setDialog(null)}>
          <p className="rules-copy">
            Move checkers diagonally, jump enemies, chain available jumps, and crown pieces on the far row.
            Knights move and capture like chess knights, rest through their owner&apos;s next turn after moving,
            and are never forced to capture. Win by taking every enemy checker; the knight may survive.
          </p>
          <div className="modal-actions single-action">
            <button className="button primary" type="button" data-autofocus onClick={() => setDialog(null)}>Got it</button>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}

function PlayerBar({
  name,
  player,
  active,
  isYou = false,
  isBot = false
}: {
  name: string;
  player: Player;
  active: boolean;
  isYou?: boolean;
  isBot?: boolean;
}) {
  return (
    <div className={`player-bar ${player} ${active ? "active" : ""}`}>
      <span className="player-avatar" aria-hidden="true">{isBot ? <Bot size={22} /> : <UserRound size={22} />}</span>
      <div className="player-identity">
        <strong>{name}</strong>
        {isYou ? <span>You</span> : null}
      </div>
      <div className="player-turn-state">
        <span className="turn-pip" aria-hidden="true" />
        {active ? "To move" : "Waiting"}
      </div>
    </div>
  );
}

function RuleDialog({
  title,
  description,
  checked,
  onCheckedChange,
  onClose,
  confirmLabel,
  onConfirm,
  disabled = false
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onClose: () => void;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  return (
    <Modal title={title} description={description} onClose={onClose}>
      <label className={`setting-toggle ${disabled ? "disabled" : ""}`}>
        <span>
          <strong>Force checker captures</strong>
          <small>When a checker can jump, it must. Knights stay optional.</small>
        </span>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.currentTarget.checked)}
        />
        <span className="toggle-track" aria-hidden="true" />
      </label>
      {disabled ? <p className="setting-note">Finish the current jump before changing this setting.</p> : null}
      <div className="modal-actions">
        <button className="button secondary" type="button" onClick={onClose}>Cancel</button>
        <button className="button primary" type="button" data-autofocus onClick={onConfirm}>
          <SlidersHorizontal aria-hidden="true" size={17} />
          {confirmLabel}
        </button>
      </div>
    </Modal>
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
    } as CSSProperties & { "--move-from-x": string; "--move-from-y": string }
  };
}

function groupMovesByPiece(moves: Move[]) {
  const grouped = new Map<string, Move[]>();
  for (const move of moves) grouped.set(move.pieceId, [...(grouped.get(move.pieceId) ?? []), move]);
  return grouped;
}

function getStateMessage(
  state: ReturnType<typeof createInitialState>,
  hasForcedCheckerCapture: boolean
) {
  if (state.status.phase === "won") return state.status.message;
  if (state.forcedPieceId && state.canEndJump) return "Continue jumping or end the turn.";
  if (state.forcedPieceId) return "A checker must finish its jump.";
  if (hasForcedCheckerCapture) return "A checker capture is available.";
  return "Select a piece to make a move.";
}

function squareAriaLabel(
  square: Square,
  piece: Piece | null,
  move: Move | undefined,
  isRestingKnight: boolean
) {
  const contents = piece ? `${playerName(piece.player)} ${pieceName(piece.kind)}` : "empty";
  const restText = isRestingKnight ? ", resting" : "";
  const moveText = move
    ? move.captures.length > 0
      ? ", capture destination"
      : ", legal destination"
    : "";
  return `${squareName(square)}, ${contents}${restText}${moveText}`;
}
