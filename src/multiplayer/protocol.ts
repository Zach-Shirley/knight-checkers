import type { GameRules, GameState, Player } from "../game";

// Room chat is limited to these phrases on every platform, so no player ever sees free-form
// text from a stranger (and the app needs no report/block/filter tools for App Store review).
export const QUICK_CHAT_MESSAGES = [
  "Good luck!",
  "Good game!",
  "Nice move!",
  "Oops.",
  "Thinking...",
  "Rematch?",
  "Thanks!",
  "Well played."
] as const;

export function isQuickChatMessage(text: string) {
  return (QUICK_CHAT_MESSAGES as readonly string[]).includes(text);
}

export type RoomStage = "waiting" | "playing" | "finished";

export type PublicRoomPlayer = {
  name: string;
  player: Player;
  connected: boolean;
  isHost: boolean;
};

export type RoomChatMessage = {
  id: string;
  player: Player;
  text: string;
  sentAt: number;
};

export type RoomSnapshot = {
  code: string;
  stage: RoomStage;
  rules: GameRules;
  game: GameState;
  players: Record<Player, PublicRoomPlayer | null>;
  rematchVotes: Player[];
  chat: RoomChatMessage[];
  disconnectDeadlines: Record<Player, number | null>;
  revision: number;
};

export type PlayerSession = {
  roomCode: string;
  player: Player;
  reconnectToken: string;
};

export type RoomConnection = {
  session: PlayerSession;
  snapshot: RoomSnapshot;
};

export type ServerResponse<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export type ServerAck<T> = (response: ServerResponse<T>) => void;

// `name` must be a generated display name; `playerId` is the device's permanent ID (for ratings later).
// The room creator's color; the joiner gets the other one. Red always moves first.
export type ColorChoice = Player | "random";
export type CreateRoomPayload = { name: string; playerId?: string; rules: GameRules; color?: ColorChoice };
export type JoinRoomPayload = { code: string; name: string; playerId?: string };
export type MatchmakingPayload = { name: string; playerId?: string; rules: GameRules };
export type QueueResult = { queued: boolean };

export type ClientToServerEvents = {
  "room:create": (
    payload: CreateRoomPayload,
    ack: ServerAck<RoomConnection>
  ) => void;
  "room:join": (
    payload: JoinRoomPayload,
    ack: ServerAck<RoomConnection>
  ) => void;
  "room:resume": (
    session: PlayerSession,
    ack: ServerAck<RoomConnection>
  ) => void;
  "room:move": (moveId: string, ack: ServerAck<null>) => void;
  "room:end-jump": (ack: ServerAck<null>) => void;
  "room:resign": (ack: ServerAck<null>) => void;
  "room:rematch": (ack: ServerAck<null>) => void;
  "room:chat": (message: string, ack: ServerAck<null>) => void;
  "room:update-rules": (rules: GameRules, ack: ServerAck<null>) => void;
  "room:leave": (ack: ServerAck<null>) => void;
  "matchmaking:join": (
    payload: MatchmakingPayload,
    ack: ServerAck<QueueResult>
  ) => void;
  "matchmaking:leave": (ack: ServerAck<null>) => void;
};

export type ServerToClientEvents = {
  "room:state": (snapshot: RoomSnapshot) => void;
  "room:closed": (message: string) => void;
  "matchmaking:matched": (connection: RoomConnection) => void;
};

export type SocketData = {
  session?: PlayerSession;
  queued?: boolean;
  lastChatAt?: number;
};
