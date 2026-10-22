export const BOARD_SIZE = 8;

export const PLAYERS = ["red", "black"] as const;
export type Player = (typeof PLAYERS)[number];
export type PieceKind = "man" | "king" | "knight";

export type Square = {
  row: number;
  col: number;
};

export type Piece = {
  id: string;
  player: Player;
  kind: PieceKind;
};

export type Capture = Square & {
  pieceId: string;
};

export type Move = {
  id: string;
  pieceId: string;
  pieceKind: PieceKind;
  player: Player;
  from: Square;
  to: Square;
  captures: Capture[];
};

export type MoveLogEntry = {
  turn: number;
  player: Player;
  pieceKind: PieceKind;
  from: Square;
  to: Square;
  captured: PieceKind[];
  notation: string;
};

export type GameStatus =
  | {
      phase: "playing";
      message: string;
    }
  | {
      phase: "won";
      winner: Player;
      reason: "captured-checkers" | "no-legal-moves" | "resignation";
      message: string;
    };

export type GameRules = {
  forceCheckerCaptures: boolean;
};

export type GameState = {
  board: (Piece | null)[][];
  currentPlayer: Player;
  forcedPieceId: string | null;
  canEndJump: boolean;
  knightCooldown: Record<Player, number>;
  rules: GameRules;
  turnNumber: number;
  moveLog: MoveLogEntry[];
  status: GameStatus;
};

type LocatedPiece = {
  piece: Piece;
  square: Square;
};

const DARK_SQUARE_REMAINDER = 1;
const BLACK_KNIGHT_START: Square = { row: 1, col: 3 };
const RED_KNIGHT_START: Square = { row: 6, col: 4 };
export const DEFAULT_GAME_RULES: GameRules = {
  forceCheckerCaptures: true
};
const KNIGHT_OFFSETS = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1]
] as const;

export function createInitialState(rules: GameRules = DEFAULT_GAME_RULES): GameState {
  const board = createEmptyBoard();
  let redMen = 0;
  let blackMen = 0;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (!isDarkSquare({ row, col })) {
        continue;
      }

      if (row <= 2) {
        blackMen += 1;
        board[row][col] = {
          id: `black-man-${blackMen}`,
          player: "black",
          kind: "man"
        };
      }

      if (row >= 5) {
        redMen += 1;
        board[row][col] = {
          id: `red-man-${redMen}`,
          player: "red",
          kind: "man"
        };
      }
    }
  }

  board[BLACK_KNIGHT_START.row][BLACK_KNIGHT_START.col] = {
    id: "black-knight",
    player: "black",
    kind: "knight"
  };
  board[RED_KNIGHT_START.row][RED_KNIGHT_START.col] = {
    id: "red-knight",
    player: "red",
    kind: "knight"
  };

  const state: GameState = {
    board,
    currentPlayer: "red",
    forcedPieceId: null,
    canEndJump: false,
    knightCooldown: {
      red: 0,
      black: 0
    },
    rules,
    turnNumber: 1,
    moveLog: [],
    status: {
      phase: "playing",
      message: "Red to move"
    }
  };

  return {
    ...state,
    status: evaluateStatus(state)
  };
}

export function getLegalMoves(state: GameState, player = state.currentPlayer): Move[] {
  if (state.status.phase !== "playing") {
    return [];
  }

  if (state.forcedPieceId) {
    const forcedPiece = findPiece(state, state.forcedPieceId);
    if (!forcedPiece || forcedPiece.piece.player !== player) {
      return [];
    }

    return getRawMovesForPiece(state, forcedPiece, true);
  }

  const moves = getPlayerPieces(state, player).flatMap((locatedPiece) =>
    getRawMovesForPiece(state, locatedPiece, false)
  );

  if (!state.rules.forceCheckerCaptures) {
    return moves;
  }

  const checkerCaptures = moves.filter(
    (move) => move.pieceKind !== "knight" && move.captures.length > 0
  );

  if (checkerCaptures.length === 0) {
    return moves;
  }

  const knightMoves = moves.filter((move) => move.pieceKind === "knight");

  return [...checkerCaptures, ...knightMoves];
}

export function applyMove(state: GameState, moveId: string): GameState {
  const move = getLegalMoves(state).find((candidate) => candidate.id === moveId);

  if (!move) {
    throw new Error(`Illegal move: ${moveId}`);
  }

  const board = cloneBoard(state.board);
  const movingPiece = board[move.from.row][move.from.col];

  if (!movingPiece) {
    throw new Error("Cannot move from an empty square.");
  }

  const originalKind = movingPiece.kind;
  const capturedKinds = move.captures
    .map((capture) => state.board[capture.row][capture.col]?.kind)
    .filter((kind): kind is PieceKind => Boolean(kind));

  board[move.from.row][move.from.col] = null;
  for (const capture of move.captures) {
    board[capture.row][capture.col] = null;
  }

  const promotedPiece: Piece = {
    ...movingPiece,
    kind:
      movingPiece.kind === "man" && isPromotionRow(movingPiece.player, move.to.row)
        ? "king"
        : movingPiece.kind
  };

  board[move.to.row][move.to.col] = promotedPiece;

  const nextLogEntry: MoveLogEntry = {
    turn: state.turnNumber,
    player: move.player,
    pieceKind: originalKind,
    from: move.from,
    to: move.to,
    captured: capturedKinds,
    notation: formatMoveNotation(move, capturedKinds, promotedPiece.kind !== originalKind)
  };

  const intermediate: GameState = {
    ...state,
    board,
    moveLog: [...state.moveLog, nextLogEntry]
  };

  const shouldContinueJump =
    originalKind !== "knight" &&
    move.captures.length > 0 &&
    promotedPiece.kind === originalKind &&
    getRawMovesForPiece(
      intermediate,
      {
        piece: promotedPiece,
        square: move.to
      },
      true
    ).length > 0;

  if (shouldContinueJump) {
    return {
      ...intermediate,
      forcedPieceId: promotedPiece.id,
      canEndJump: !state.rules.forceCheckerCaptures,
      status: {
        phase: "playing",
        message: state.rules.forceCheckerCaptures
          ? `${playerName(move.player)} must finish the jump`
          : `${playerName(move.player)} may continue the jump`
      }
    };
  }

  return finishTurn(intermediate, originalKind);
}

export function updateGameRules(state: GameState, rules: GameRules): GameState {
  const nextState: GameState = {
    ...state,
    forcedPieceId: rules.forceCheckerCaptures ? state.forcedPieceId : null,
    canEndJump: rules.forceCheckerCaptures ? state.canEndJump : false,
    rules
  };

  return {
    ...nextState,
    status: evaluateStatus(nextState)
  };
}

export function endOptionalJump(state: GameState): GameState {
  if (!state.forcedPieceId || !state.canEndJump) {
    throw new Error("No optional jump is available to end.");
  }

  const movingPiece = findPiece(state, state.forcedPieceId);
  if (!movingPiece || movingPiece.piece.player !== state.currentPlayer) {
    throw new Error("Cannot end a jump for a missing piece.");
  }

  return finishTurn(
    {
      ...state,
      forcedPieceId: null,
      canEndJump: false
    },
    movingPiece.piece.kind
  );
}

export function resignGame(state: GameState, player: Player = state.currentPlayer): GameState {
  if (state.status.phase === "won") {
    return state;
  }

  const winner = opponentOf(player);
  return {
    ...state,
    forcedPieceId: null,
    canEndJump: false,
    status: {
      phase: "won",
      winner,
      reason: "resignation",
      message: `${playerName(winner)} wins by resignation`
    }
  };
}

export function getPieceCounts(state: GameState) {
  const counts: Record<
    Player,
    {
      men: number;
      kings: number;
      knights: number;
      checkers: number;
      total: number;
    }
  > = {
    red: {
      men: 0,
      kings: 0,
      knights: 0,
      checkers: 0,
      total: 0
    },
    black: {
      men: 0,
      kings: 0,
      knights: 0,
      checkers: 0,
      total: 0
    }
  };

  for (const locatedPiece of getAllPieces(state)) {
    const side = counts[locatedPiece.piece.player];
    side.total += 1;

    if (locatedPiece.piece.kind === "man") {
      side.men += 1;
      side.checkers += 1;
    }

    if (locatedPiece.piece.kind === "king") {
      side.kings += 1;
      side.checkers += 1;
    }

    if (locatedPiece.piece.kind === "knight") {
      side.knights += 1;
    }
  }

  return counts;
}

export function getPieceAt(state: GameState, square: Square): Piece | null {
  if (!isInside(square)) {
    return null;
  }

  return state.board[square.row][square.col];
}

export function findPiece(state: GameState, pieceId: string): LocatedPiece | null {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = state.board[row][col];
      if (piece?.id === pieceId) {
        return {
          piece,
          square: { row, col }
        };
      }
    }
  }

  return null;
}

export function isDarkSquare(square: Square): boolean {
  return (square.row + square.col) % 2 === DARK_SQUARE_REMAINDER;
}

export function squareName(square: Square): string {
  const file = String.fromCharCode("a".charCodeAt(0) + square.col);
  const rank = BOARD_SIZE - square.row;
  return `${file}${rank}`;
}

export function opponentOf(player: Player): Player {
  return player === "red" ? "black" : "red";
}

export function playerName(player: Player): string {
  return player === "red" ? "Red" : "Black";
}

export function pieceName(kind: PieceKind): string {
  if (kind === "man") {
    return "checker";
  }

  return kind;
}

function finishTurn(state: GameState, movedPieceKind: PieceKind): GameState {
  const movedPlayer = state.currentPlayer;
  const knightCooldown = {
    ...state.knightCooldown
  };

  if (movedPieceKind === "knight") {
    knightCooldown[movedPlayer] = 1;
  } else if (knightCooldown[movedPlayer] > 0) {
    knightCooldown[movedPlayer] -= 1;
  }

  const nextState: GameState = {
    ...state,
    currentPlayer: opponentOf(movedPlayer),
    forcedPieceId: null,
    canEndJump: false,
    knightCooldown,
    turnNumber: state.turnNumber + 1
  };

  return {
    ...nextState,
    status: evaluateStatus(nextState)
  };
}

function evaluateStatus(state: GameState): GameStatus {
  const counts = getPieceCounts(state);
  const redHasCheckers = counts.red.checkers > 0;
  const blackHasCheckers = counts.black.checkers > 0;

  if (!redHasCheckers) {
    return {
      phase: "won",
      winner: "black",
      reason: "captured-checkers",
      message: "Black wins by taking Red's checkers"
    };
  }

  if (!blackHasCheckers) {
    return {
      phase: "won",
      winner: "red",
      reason: "captured-checkers",
      message: "Red wins by taking Black's checkers"
    };
  }

  const legalMoves = getLegalMovesIgnoringStatus(state, state.currentPlayer);
  if (legalMoves.length === 0) {
    const winner = opponentOf(state.currentPlayer);
    return {
      phase: "won",
      winner,
      reason: "no-legal-moves",
      message: `${playerName(winner)} wins because ${playerName(state.currentPlayer)} has no legal move`
    };
  }

  return {
    phase: "playing",
    message: `${playerName(state.currentPlayer)} to move`
  };
}

function getLegalMovesIgnoringStatus(state: GameState, player: Player): Move[] {
  const playableState: GameState = {
    ...state,
    status: {
      phase: "playing",
      message: ""
    }
  };

  return getLegalMoves(playableState, player);
}

function getRawMovesForPiece(
  state: GameState,
  locatedPiece: LocatedPiece,
  capturesOnly: boolean
): Move[] {
  if (locatedPiece.piece.kind === "knight") {
    return getKnightMoves(state, locatedPiece, capturesOnly);
  }

  return getCheckerMoves(state, locatedPiece, capturesOnly);
}

function getCheckerMoves(state: GameState, locatedPiece: LocatedPiece, capturesOnly: boolean): Move[] {
  const directions = getCheckerDirections(locatedPiece.piece);
  const moves: Move[] = [];

  for (const [rowDelta, colDelta] of directions) {
    const adjacent = {
      row: locatedPiece.square.row + rowDelta,
      col: locatedPiece.square.col + colDelta
    };
    const landing = {
      row: locatedPiece.square.row + rowDelta * 2,
      col: locatedPiece.square.col + colDelta * 2
    };

    if (!capturesOnly && isInside(adjacent) && !getPieceAt(state, adjacent)) {
      moves.push(createMove(locatedPiece, adjacent, []));
    }

    const jumpedPiece = getPieceAt(state, adjacent);
    if (
      jumpedPiece &&
      jumpedPiece.player !== locatedPiece.piece.player &&
      isInside(landing) &&
      !getPieceAt(state, landing)
    ) {
      moves.push(
        createMove(locatedPiece, landing, [
          {
            ...adjacent,
            pieceId: jumpedPiece.id
          }
        ])
      );
    }
  }

  return moves;
}

function getKnightMoves(state: GameState, locatedPiece: LocatedPiece, capturesOnly: boolean): Move[] {
  if (state.knightCooldown[locatedPiece.piece.player] > 0) {
    return [];
  }

  const moves: Move[] = [];

  for (const [rowDelta, colDelta] of KNIGHT_OFFSETS) {
    const destination = {
      row: locatedPiece.square.row + rowDelta,
      col: locatedPiece.square.col + colDelta
    };

    if (!isInside(destination)) {
      continue;
    }

    const target = getPieceAt(state, destination);
    if (!target && !capturesOnly) {
      moves.push(createMove(locatedPiece, destination, []));
    }

    if (target && target.player !== locatedPiece.piece.player) {
      moves.push(
        createMove(locatedPiece, destination, [
          {
            ...destination,
            pieceId: target.id
          }
        ])
      );
    }
  }

  return moves;
}

function getCheckerDirections(piece: Piece): number[][] {
  if (piece.kind === "king") {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ];
  }

  const forward = piece.player === "red" ? -1 : 1;
  return [
    [forward, -1],
    [forward, 1]
  ];
}

function createMove(locatedPiece: LocatedPiece, to: Square, captures: Capture[]): Move {
  const captureKey = captures.map((capture) => capture.pieceId).join(",");
  const separator = captures.length > 0 ? "x" : "-";

  return {
    id: `${locatedPiece.piece.id}:${squareName(locatedPiece.square)}${separator}${squareName(to)}:${captureKey}`,
    pieceId: locatedPiece.piece.id,
    pieceKind: locatedPiece.piece.kind,
    player: locatedPiece.piece.player,
    from: locatedPiece.square,
    to,
    captures
  };
}

function formatMoveNotation(move: Move, capturedKinds: PieceKind[], promoted: boolean): string {
  const action = move.captures.length > 0 ? "x" : "-";
  const captureText =
    capturedKinds.length > 0
      ? ` captures ${capturedKinds.map(pieceName).join(", ")}`
      : "";
  const promotionText = promoted ? " crowns" : "";

  return `${playerName(move.player)} ${pieceName(move.pieceKind)} ${squareName(move.from)} ${action} ${squareName(
    move.to
  )}${captureText}${promotionText}`;
}

function getPlayerPieces(state: GameState, player: Player): LocatedPiece[] {
  return getAllPieces(state).filter((locatedPiece) => locatedPiece.piece.player === player);
}

function getAllPieces(state: GameState): LocatedPiece[] {
  const pieces: LocatedPiece[] = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = state.board[row][col];
      if (piece) {
        pieces.push({
          piece,
          square: { row, col }
        });
      }
    }
  }

  return pieces;
}

function createEmptyBoard(): (Piece | null)[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array<Piece | null>(BOARD_SIZE).fill(null));
}

function cloneBoard(board: (Piece | null)[][]): (Piece | null)[][] {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function isInside(square: Square): boolean {
  return (
    square.row >= 0 &&
    square.row < BOARD_SIZE &&
    square.col >= 0 &&
    square.col < BOARD_SIZE
  );
}

function isPromotionRow(player: Player, row: number): boolean {
  return player === "red" ? row === 0 : row === BOARD_SIZE - 1;
}

// Material points: knight 3, king 2, checker 1.
export const PIECE_POINTS: Record<PieceKind, number> = { man: 1, king: 2, knight: 3 };

export type Material = {
  // Points still on the board for each side.
  score: Record<Player, number>;
  // Enemy pieces each side has captured, as they were when taken (a crowned king counts as a king).
  captured: Record<Player, PieceKind[]>;
};

export function getMaterial(state: GameState): Material {
  const score: Record<Player, number> = { red: 0, black: 0 };
  for (const row of state.board) {
    for (const piece of row) {
      if (piece) score[piece.player] += PIECE_POINTS[piece.kind];
    }
  }
  const captured: Record<Player, PieceKind[]> = { red: [], black: [] };
  for (const entry of state.moveLog) captured[entry.player].push(...entry.captured);
  return { score, captured };
}
