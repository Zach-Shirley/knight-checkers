import { describe, expect, it } from "vitest";
import { chooseBotAction, type BotAction, type BotLevel } from "../src/bot";
import {
  applyMove,
  createInitialState,
  endOptionalJump,
  getLegalMoves,
  type GameState,
  type Piece,
  type PieceKind,
  type Player
} from "../src/game";

function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

type Placement = [square: string, player: Player, kind: PieceKind];

function position(pieces: Placement[], options: { toMove?: Player; forceCheckerCaptures?: boolean } = {}): GameState {
  const state = createInitialState({ forceCheckerCaptures: options.forceCheckerCaptures ?? true });
  const board: (Piece | null)[][] = state.board.map((row) => row.map(() => null));
  pieces.forEach(([square, player, kind], index) => {
    const col = square.charCodeAt(0) - 97;
    const row = 8 - Number(square[1]);
    board[row][col] = { id: `${player}-${kind}-${index}`, player, kind };
  });
  return { ...state, board, currentPlayer: options.toMove ?? "red" };
}

function act(state: GameState, action: BotAction) {
  return action.type === "end-jump" ? endOptionalJump(state) : applyMove(state, action.moveId);
}

function moveOf(state: GameState, action: BotAction | null) {
  if (!action || action.type !== "move") return null;
  return getLegalMoves(state).find((move) => move.id === action.moveId) ?? null;
}

function play(red: BotLevel, black: BotLevel, seed: number, maxPlies = 300) {
  const random = seeded(seed);
  let state = createInitialState();
  for (let ply = 0; ply < maxPlies && state.status.phase === "playing"; ply++) {
    const level = state.currentPlayer === "red" ? red : black;
    const action = chooseBotAction(state, level, { random, timeLimitMs: 60 });
    if (!action) break;
    state = act(state, action);
  }
  return state.status.phase === "won" ? state.status.winner : "draw";
}

describe("bot", () => {
  it("returns a legal action at every level", () => {
    const state = createInitialState();
    for (const level of ["easy", "medium", "hard"] as const) {
      const move = moveOf(state, chooseBotAction(state, level, { random: seeded(7), timeLimitMs: 150 }));
      expect(move).not.toBeNull();
    }
  });

  it("takes a free piece when captures are optional", () => {
    const state = position(
      [["c3", "red", "man"], ["g1", "red", "man"], ["d4", "black", "man"], ["h8", "black", "man"]],
      { forceCheckerCaptures: false }
    );
    const move = moveOf(state, chooseBotAction(state, "hard", { timeLimitMs: 200 }));
    expect(move?.captures.length).toBe(1);
  });

  it("does not walk a checker into a capture", () => {
    // Red's c3 man can go to b4 (safe) or d4 (taken by e5 jumping to c3).
    const state = position([["c3", "red", "man"], ["e5", "black", "man"], ["a7", "black", "man"]]);
    const move = moveOf(state, chooseBotAction(state, "hard", { timeLimitMs: 200 }));
    expect(move?.to).toEqual({ row: 4, col: 1 });
  });

  it("finishes a multi-jump", () => {
    const state = position([["a1", "red", "man"], ["b2", "black", "man"], ["d4", "black", "man"], ["h8", "black", "man"]], {
      toMove: "red"
    });
    let next = state;
    const first = chooseBotAction(next, "hard", { timeLimitMs: 200 });
    next = act(next, first!);
    expect(next.forcedPieceId).not.toBeNull();
    const second = moveOf(next, chooseBotAction(next, "hard", { timeLimitMs: 200 }));
    expect(second?.captures.length).toBe(1);
  });

  it("medium beats easy most of the time", () => {
    let mediumWins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      if (play("medium", "easy", seed) === "red") mediumWins++;
      if (play("easy", "medium", seed + 100) === "black") mediumWins++;
    }
    expect(mediumWins).toBeGreaterThanOrEqual(9);
  }, 60_000);

  it("hard answers within its time budget", () => {
    const state = createInitialState();
    const started = performance.now();
    chooseBotAction(state, "hard");
    expect(performance.now() - started).toBeLessThan(1500);
  });
});
