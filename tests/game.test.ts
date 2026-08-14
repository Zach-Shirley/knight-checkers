import { describe, expect, it } from "vitest";
import {
  GameState,
  Move,
  Piece,
  applyMove,
  createInitialState,
  endOptionalJump,
  getLegalMoves,
  getPieceCounts,
  resignGame
} from "../src/game";

describe("Knight Checkers rules", () => {
  it("starts with normal checkers plus an adjacent second-rank knight for each side", () => {
    const state = createInitialState();
    const counts = getPieceCounts(state);

    expect(counts.red.men).toBe(12);
    expect(counts.black.men).toBe(12);
    expect(counts.red.knights).toBe(1);
    expect(counts.black.knights).toBe(1);
    expect(state.board[6][4]).toMatchObject({ player: "red", kind: "knight" });
    expect(state.board[6][3]).toMatchObject({ player: "red", kind: "man" });
    expect(state.board[1][3]).toMatchObject({ player: "black", kind: "knight" });
    expect(state.board[1][4]).toMatchObject({ player: "black", kind: "man" });
  });

  it("forces captures when a checker jump is available", () => {
    const state = stateFromPieces(
      "red",
      [
        ["red-man", "red", "man", 5, 0],
        ["black-man", "black", "man", 4, 1],
        ["black-other", "black", "man", 2, 5]
      ],
      { red: 0, black: 0 }
    );

    const moves = getLegalMoves(state);

    expect(moves).toHaveLength(1);
    expect(moves[0].from).toEqual({ row: 5, col: 0 });
    expect(moves[0].to).toEqual({ row: 3, col: 2 });
    expect(moves[0].captures.map((capture) => capture.pieceId)).toEqual(["black-man"]);
  });

  it("never forces knight captures", () => {
    const state = stateFromPieces(
      "red",
      [
        ["red-knight", "red", "knight", 4, 3],
        ["red-man", "red", "man", 5, 0],
        ["black-target", "black", "man", 2, 4],
        ["black-anchor", "black", "man", 0, 7]
      ],
      { red: 0, black: 0 }
    );

    const moves = getLegalMoves(state);

    expect(moves.some((move) => move.pieceId === "red-knight" && move.captures.length > 0)).toBe(true);
    expect(moves.some((move) => move.pieceId === "red-knight" && move.captures.length === 0)).toBe(true);
    expect(moves.some((move) => move.pieceId === "red-man" && move.captures.length === 0)).toBe(true);
  });

  it("forces checker captures without blocking optional knight moves", () => {
    const state = stateFromPieces(
      "red",
      [
        ["red-jumper", "red", "man", 5, 0],
        ["red-slider", "red", "man", 5, 6],
        ["red-knight", "red", "knight", 6, 3],
        ["black-victim", "black", "man", 4, 1],
        ["black-anchor", "black", "man", 0, 7]
      ],
      { red: 0, black: 0 }
    );

    const moves = getLegalMoves(state);

    expect(moves.some((move) => move.pieceId === "red-jumper" && move.captures.length > 0)).toBe(true);
    expect(moves.some((move) => move.pieceId === "red-knight")).toBe(true);
    expect(moves.some((move) => move.pieceId === "red-slider")).toBe(false);
  });

  it("allows non-captures and offers optional multi-jump continuation when checker capture forcing is off", () => {
    const state = stateFromPieces(
      "red",
      [
        ["red-man", "red", "man", 5, 2],
        ["black-one", "black", "man", 4, 3],
        ["black-two", "black", "man", 2, 5],
        ["black-anchor", "black", "man", 0, 7]
      ],
      { red: 0, black: 0 },
      { forceCheckerCaptures: false }
    );

    const moves = getLegalMoves(state);
    const slide = moves.find((move) => move.to.row === 4 && move.to.col === 1);
    const jump = moves.find((move) => move.to.row === 3 && move.to.col === 4);

    expect(slide).toBeTruthy();
    expect(jump).toBeTruthy();

    const afterJump = applyMove(state, jump!.id);

    expect(afterJump.currentPlayer).toBe("red");
    expect(afterJump.forcedPieceId).toBe("red-man");
    expect(afterJump.canEndJump).toBe(true);
    expect(getLegalMoves(afterJump).some((move) => move.to.row === 1 && move.to.col === 6)).toBe(true);

    const afterEndingJump = endOptionalJump(afterJump);

    expect(afterEndingJump.currentPlayer).toBe("black");
    expect(afterEndingJump.forcedPieceId).toBeNull();
    expect(afterEndingJump.canEndJump).toBe(false);
  });

  it("keeps the same player moving through a multi-jump", () => {
    const state = stateFromPieces(
      "red",
      [
        ["red-man", "red", "man", 5, 0],
        ["black-one", "black", "man", 4, 1],
        ["black-two", "black", "man", 2, 3],
        ["black-anchor", "black", "man", 0, 7]
      ],
      { red: 0, black: 0 }
    );

    const firstJump = getLegalMoves(state)[0];
    const afterFirstJump = applyMove(state, firstJump.id);
    const nextMoves = getLegalMoves(afterFirstJump);

    expect(afterFirstJump.currentPlayer).toBe("red");
    expect(afterFirstJump.forcedPieceId).toBe("red-man");
    expect(nextMoves).toHaveLength(1);
    expect(nextMoves[0].to).toEqual({ row: 1, col: 4 });
  });

  it("makes a knight rest for that player's next turn after it moves", () => {
    const state = stateFromPieces(
      "red",
      [
        ["red-knight", "red", "knight", 6, 3],
        ["red-man", "red", "man", 5, 0],
        ["black-man", "black", "man", 0, 1],
        ["black-other", "black", "man", 2, 5]
      ],
      { red: 0, black: 0 }
    );

    const knightMove = getLegalMoves(state).find((move) => move.pieceId === "red-knight");
    expect(knightMove).toBeTruthy();

    const afterKnightMove = applyMove(state, knightMove!.id);
    expect(afterKnightMove.knightCooldown.red).toBe(1);

    const blackMove = getLegalMoves(afterKnightMove)[0];
    const redRestTurn = applyMove(afterKnightMove, blackMove.id);

    expect(redRestTurn.currentPlayer).toBe("red");
    expect(redRestTurn.knightCooldown.red).toBe(1);
    expect(getLegalMoves(redRestTurn).some((move) => move.pieceId === "red-knight")).toBe(false);

    const checkerMove = getLegalMoves(redRestTurn).find((move) => move.pieceId === "red-man");
    expect(checkerMove).toBeTruthy();

    const afterCheckerMove = applyMove(redRestTurn, checkerMove!.id);
    expect(afterCheckerMove.knightCooldown.red).toBe(0);

    const blackReply = getLegalMoves(afterCheckerMove)[0];
    const redReadyTurn = applyMove(afterCheckerMove, blackReply.id);

    expect(redReadyTurn.knightCooldown.red).toBe(0);
    expect(getLegalMoves(redReadyTurn).some((move) => move.pieceId === "red-knight")).toBe(true);
  });

  it("allows checkers to jump and capture a knight", () => {
    const state = stateFromPieces(
      "red",
      [
        ["red-man", "red", "man", 5, 0],
        ["black-knight", "black", "knight", 4, 1],
        ["black-man", "black", "man", 0, 7]
      ],
      { red: 0, black: 0 }
    );

    const jump = getLegalMoves(state)[0];
    const afterJump = applyMove(state, jump.id);
    const counts = getPieceCounts(afterJump);

    expect(jump.captures.map((capture) => capture.pieceId)).toEqual(["black-knight"]);
    expect(counts.black.knights).toBe(0);
  });

  it("completes a checker double jump and switches turns after the second jump", () => {
    const state = stateFromPieces(
      "red",
      [
        ["red-man", "red", "man", 5, 0],
        ["black-one", "black", "man", 4, 1],
        ["black-two", "black", "man", 2, 3],
        ["black-anchor", "black", "man", 0, 7]
      ],
      { red: 0, black: 0 }
    );

    const jump1 = getLegalMoves(state)[0];
    const after1 = applyMove(state, jump1.id);

    expect(after1.currentPlayer).toBe("red");
    expect(after1.forcedPieceId).toBe("red-man");

    const jump2 = getLegalMoves(after1)[0];
    const after2 = applyMove(after1, jump2.id);

    expect(after2.currentPlayer).toBe("black");
    expect(after2.forcedPieceId).toBeNull();
    expect(getPieceCounts(after2).black.men).toBe(1);
  });

  it("completes a checker triple jump, promoting at the back rank and ending the chain", () => {
    const state = stateFromPieces(
      "red",
      [
        ["red-man", "red", "man", 6, 1],
        ["black-one", "black", "man", 5, 2],
        ["black-two", "black", "man", 3, 4],
        ["black-three", "black", "man", 1, 6]
      ],
      { red: 0, black: 0 }
    );

    const jump1 = getLegalMoves(state).find((m) => m.to.row === 4 && m.to.col === 3);
    expect(jump1).toBeTruthy();
    const after1 = applyMove(state, jump1!.id);
    expect(after1.currentPlayer).toBe("red");
    expect(after1.forcedPieceId).toBe("red-man");

    const jump2 = getLegalMoves(after1).find((m) => m.to.row === 2 && m.to.col === 5);
    expect(jump2).toBeTruthy();
    const after2 = applyMove(after1, jump2!.id);
    expect(after2.currentPlayer).toBe("red");
    expect(after2.forcedPieceId).toBe("red-man");

    const jump3 = getLegalMoves(after2).find((m) => m.to.row === 0 && m.to.col === 7);
    expect(jump3).toBeTruthy();
    const after3 = applyMove(after2, jump3!.id);

    expect(after3.forcedPieceId).toBeNull();
    expect(after3.board[0][7]?.kind).toBe("king");
    expect(getPieceCounts(after3).black.men).toBe(0);
  });

  it("king can multi-jump with direction changes between jumps", () => {
    const state = stateFromPieces(
      "red",
      [
        ["red-king", "red", "king", 2, 3],
        ["black-one", "black", "man", 3, 4],
        ["black-two", "black", "man", 5, 4],
        ["black-anchor", "black", "man", 0, 7]
      ],
      { red: 0, black: 0 }
    );

    const jump1 = getLegalMoves(state).find((m) => m.to.row === 4 && m.to.col === 5);
    expect(jump1).toBeTruthy();
    const after1 = applyMove(state, jump1!.id);

    expect(after1.currentPlayer).toBe("red");
    expect(after1.forcedPieceId).toBe("red-king");

    const jump2 = getLegalMoves(after1).find((m) => m.to.row === 6 && m.to.col === 3);
    expect(jump2).toBeTruthy();
    const after2 = applyMove(after1, jump2!.id);

    expect(after2.currentPlayer).toBe("black");
    expect(after2.forcedPieceId).toBeNull();
    expect(getPieceCounts(after2).black.men).toBe(1);
  });

  it("does not require a knight to be captured for the win", () => {
    const state = stateFromPieces(
      "red",
      [
        ["red-man", "red", "man", 5, 0],
        ["black-man", "black", "man", 4, 1],
        ["black-knight", "black", "knight", 2, 5]
      ],
      { red: 0, black: 0 }
    );

    const jump = getLegalMoves(state)[0];
    const afterJump = applyMove(state, jump.id);

    expect(afterJump.status.phase).toBe("won");
    expect(afterJump.status.phase === "won" ? afterJump.status.winner : null).toBe("red");
    expect(getPieceCounts(afterJump).black.knights).toBe(1);
  });

  it("ends a local game when the current player resigns", () => {
    const state = createInitialState();
    const resigned = resignGame(state);

    expect(resigned.status).toMatchObject({
      phase: "won",
      winner: "black",
      reason: "resignation"
    });
    expect(getLegalMoves(resigned)).toEqual([]);
  });
});

function stateFromPieces(
  currentPlayer: GameState["currentPlayer"],
  pieces: Array<[string, Piece["player"], Piece["kind"], number, number]>,
  knightCooldown: GameState["knightCooldown"],
  rules: GameState["rules"] = { forceCheckerCaptures: true }
): GameState {
  const board = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));

  for (const [id, player, kind, row, col] of pieces) {
    board[row][col] = {
      id,
      player,
      kind
    };
  }

  return {
    board,
    currentPlayer,
    forcedPieceId: null,
    canEndJump: false,
    knightCooldown,
    rules,
    turnNumber: 1,
    moveLog: [],
    status: {
      phase: "playing",
      message: ""
    }
  };
}
