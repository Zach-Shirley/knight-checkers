// Knight Checkers bot: alpha-beta search over the shared rules engine.
// A "ply" here is one action, so a multi-jump is several plies by the same player.
import {
  BOARD_SIZE,
  applyMove,
  endOptionalJump,
  getLegalMoves,
  type GameState,
  type Move,
  type Player
} from "./game";

export type BotLevel = "easy" | "medium" | "hard";

export const BOT_LEVELS: Record<BotLevel, { label: string; description: string }> = {
  easy: { label: "Easy", description: "Learning the ropes. Misses things." },
  medium: { label: "Medium", description: "Looks a few moves ahead." },
  hard: { label: "Hard", description: "Thinks deep. Punishes mistakes." }
};

export type BotAction = { type: "move"; moveId: string } | { type: "end-jump" };

type LevelSettings = {
  maxDepth: number;
  timeLimitMs: number;
  // Random score noise, in centi-checkers, so weaker bots pick imperfect moves.
  noise: number;
  // Chance of playing a random legal move outright.
  blunderChance: number;
};

const LEVEL_SETTINGS: Record<BotLevel, LevelSettings> = {
  easy: { maxDepth: 1, timeLimitMs: 200, noise: 90, blunderChance: 0.3 },
  medium: { maxDepth: 3, timeLimitMs: 500, noise: 25, blunderChance: 0.05 },
  hard: { maxDepth: 9, timeLimitMs: 900, noise: 0, blunderChance: 0 }
};

const WIN_SCORE = 100_000;
const PIECE_VALUE = { man: 100, king: 170, knight: 120 } as const;
const MAX_QUIESCENCE_PLIES = 6;

type Option = { action: BotAction; move: Move | null };

export type BotOptions = {
  random?: () => number;
  now?: () => number;
  timeLimitMs?: number;
};

export function chooseBotAction(state: GameState, level: BotLevel, botOptions: BotOptions = {}): BotAction | null {
  const { random = Math.random, now = () => performance.now() } = botOptions;
  const options = getOptions(state);
  if (options.length === 0) return null;
  if (options.length === 1) return options[0].action;

  const settings = LEVEL_SETTINGS[level];
  if (random() < settings.blunderChance) {
    return options[Math.floor(random() * options.length)].action;
  }

  const me = state.currentPlayer;
  const deadline = now() + (botOptions.timeLimitMs ?? settings.timeLimitMs);
  let best: { option: Option; score: number }[] = options.map((option) => ({ option, score: 0 }));

  // Iterative deepening: keep the deepest fully searched result when time runs out.
  for (let depth = 1; depth <= settings.maxDepth; depth++) {
    const search = new Search(me, deadline, now);
    const scored: { option: Option; score: number }[] = [];
    let alpha = -Infinity;
    for (const { option } of best) {
      const next = applyOption(state, option);
      const score = search.minimax(next, depth - 1, alpha, Infinity, 1);
      if (search.timedOut) break;
      scored.push({ option, score });
      alpha = Math.max(alpha, score);
    }
    // A pass cut off by the clock has unreliable scores; keep the previous depth.
    if (search.timedOut) break;
    // Best first, so the next iteration searches the strongest line first (better pruning).
    best = scored.sort((a, b) => b.score - a.score);
    if (best[0].score >= WIN_SCORE - 100) break;
  }

  const withNoise = best.map(({ option, score }) => ({
    option,
    score: score + (settings.noise ? (random() * 2 - 1) * settings.noise : 0)
  }));
  withNoise.sort((a, b) => b.score - a.score);
  return withNoise[0].option.action;
}

class Search {
  timedOut = false;
  private nodes = 0;

  constructor(
    private readonly me: Player,
    private readonly deadline: number,
    private readonly now: () => number
  ) {}

  minimax(state: GameState, depth: number, alpha: number, beta: number, ply: number): number {
    if (++this.nodes % 256 === 0 && this.now() > this.deadline) this.timedOut = true;
    if (this.timedOut) return 0;

    if (state.status.phase === "won") {
      // Prefer faster wins and slower losses.
      return state.status.winner === this.me ? WIN_SCORE - ply : -WIN_SCORE + ply;
    }

    let options = getOptions(state);
    if (options.length === 0) return evaluate(state, this.me);
    const maximizing = state.currentPlayer === this.me;
    let best = maximizing ? -Infinity : Infinity;

    if (depth <= 0) {
      // Quiescence: keep resolving captures and jump chains so the bot doesn't stop
      // searching in the middle of an exchange.
      const tactical = state.forcedPieceId ? options : options.filter((option) => (option.move?.captures.length ?? 0) > 0);
      const standPat = evaluate(state, this.me);
      if (tactical.length === 0 || depth <= -MAX_QUIESCENCE_PLIES) return standPat;
      // If the side to move has a quiet alternative, it can decline the exchange ("stand pat").
      if (tactical.length < options.length) {
        best = standPat;
        if (maximizing) alpha = Math.max(alpha, standPat);
        else beta = Math.min(beta, standPat);
        if (beta <= alpha) return best;
      }
      options = tactical;
    }

    for (const option of orderOptions(options)) {
      const score = this.minimax(applyOption(state, option), depth - 1, alpha, beta, ply + 1);
      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, score);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, score);
      }
      if (beta <= alpha || this.timedOut) break;
    }
    return best;
  }
}

function getOptions(state: GameState): Option[] {
  const options: Option[] = getLegalMoves(state).map((move) => ({ action: { type: "move", moveId: move.id }, move }));
  if (state.canEndJump) options.push({ action: { type: "end-jump" }, move: null });
  return options;
}

function applyOption(state: GameState, option: Option) {
  return option.action.type === "end-jump" ? endOptionalJump(state) : applyMove(state, option.action.moveId);
}

function orderOptions(options: Option[]) {
  return [...options].sort((a, b) => (b.move?.captures.length ?? 0) - (a.move?.captures.length ?? 0));
}

// Static evaluation from `me`'s point of view, in centi-checkers.
export function evaluate(state: GameState, me: Player): number {
  let score = 0;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = state.board[row][col];
      if (!piece) continue;
      let value: number = PIECE_VALUE[piece.kind];
      // Red moves up the board (toward row 0), Black moves down.
      const advance = piece.player === "red" ? BOARD_SIZE - 1 - row : row;
      if (piece.kind === "man") {
        value += advance * 5;
        // Men on the home row stop enemy kings from being made.
        if (advance === 0) value += 8;
      }
      if (piece.kind !== "knight" && row >= 2 && row <= 5 && col >= 2 && col <= 5) value += 6;
      if (piece.kind === "knight") {
        // A knight on the rim covers half as many squares.
        const edge = Math.min(row, col, BOARD_SIZE - 1 - row, BOARD_SIZE - 1 - col);
        value += edge * 6;
        if (state.knightCooldown[piece.player] > 0) value -= 10;
      }
      score += piece.player === me ? value : -value;
    }
  }
  return score;
}
