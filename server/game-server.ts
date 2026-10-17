import { randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";
import { pathToFileURL } from "node:url";
import { Server, type Socket } from "socket.io";
import {
  applyMove,
  createInitialState,
  endOptionalJump,
  resignGame,
  type GameRules,
  type GameState,
  type Player
} from "../src/game";
import type {
  ClientToServerEvents,
  MatchmakingPayload,
  PlayerSession,
  PublicRoomPlayer,
  RoomConnection,
  RoomChatMessage,
  RoomSnapshot,
  ServerAck,
  ServerToClientEvents,
  SocketData
} from "../src/multiplayer/protocol";
import { isGeneratedName, isPlayerId } from "../src/multiplayer/names";
import { isQuickChatMessage } from "../src/multiplayer/protocol";

type ServerSideEvents = Record<string, never>;
type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  ServerSideEvents,
  SocketData
>;

type RoomSeat = PublicRoomPlayer & {
  reconnectToken: string;
  socketId: string | null;
  // Private; kept so ratings and profiles can be added later.
  playerId: string | null;
};

type GameRoom = {
  code: string;
  rules: GameRules;
  game: GameState;
  players: Record<Player, RoomSeat | null>;
  rematchVotes: Set<Player>;
  chat: RoomChatMessage[];
  disconnectDeadlines: Record<Player, number | null>;
  disconnectTimers: Record<Player, ReturnType<typeof setTimeout> | null>;
  revision: number;
};

type QueueEntry = {
  socketId: string;
  name: string;
  playerId: string | null;
  rules: GameRules;
};

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_PORT = 4175;
const MAX_CHAT_MESSAGES = 80;
const MAX_CHAT_LENGTH = 240;
const CHAT_COOLDOWN_MS = 350;
const DEFAULT_DISCONNECT_GRACE_MS = 30_000;

export function createGameServer(
  httpServer: HttpServer = createHealthServer(),
  options: { disconnectGraceMs?: number } = {}
) {
  const rooms = new Map<string, GameRoom>();
  const queue: QueueEntry[] = [];
  const disconnectGraceMs = options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
  const allowedOrigins = (
    process.env.CLIENT_ORIGINS ??
    [
      "http://127.0.0.1:4174",
      "http://localhost:4174",
      "http://knight-checkers.127.0.0.1.sslip.io:4174"
    ].join(",")
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    ServerSideEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    socket.on("room:create", (payload, ack) => {
      leaveCurrentRoom(socket, false);
      removeFromQueue(socket.id);

      const room = createRoom(rooms, payload.rules);
      const connection = seatPlayer(room, socket, resolveColor(payload.color), payload.name, payload.playerId, true);
      rooms.set(room.code, room);
      ackSuccess(ack, connection);
      broadcastRoom(room);
    });

    socket.on("room:join", (payload, ack) => {
      const code = normalizeCode(payload.code);
      const room = rooms.get(code);

      if (!room) {
        ackFailure(ack, "That room does not exist.");
        return;
      }

      // The joiner takes whichever color the host left open.
      const openSeat: Player | null = !room.players.red ? "red" : !room.players.black ? "black" : null;
      if (!openSeat) {
        ackFailure(ack, "That room is already full.");
        return;
      }

      leaveCurrentRoom(socket, false);
      removeFromQueue(socket.id);
      seatPlayer(room, socket, openSeat, payload.name, payload.playerId, false);
      bumpRevision(room);
      const connection = connectionFor(room, openSeat);
      ackSuccess(ack, connection);
      broadcastRoom(room);
    });

    socket.on("room:resume", (session, ack) => {
      const room = rooms.get(normalizeCode(session.roomCode));
      const seat = room?.players[session.player];

      if (!room || !seat || seat.reconnectToken !== session.reconnectToken) {
        ackFailure(ack, "That game session has expired.");
        return;
      }

      leaveCurrentRoom(socket, false);
      removeFromQueue(socket.id);
      seat.socketId = socket.id;
      seat.connected = true;
      clearDisconnectDeadline(room, session.player);
      socket.data.session = sessionFor(room, session.player);
      socket.join(room.code);
      bumpRevision(room);
      ackSuccess(ack, connectionFor(room, session.player));
      broadcastRoom(room);
    });

    socket.on("room:move", (moveId, ack) => {
      const membership = getMembership(socket);
      if (!membership) {
        ackFailure(ack, "You are not in a game.");
        return;
      }

      const { room, player } = membership;
      if (!room.players.red || !room.players.black) {
        ackFailure(ack, "The game is still waiting for another player.");
        return;
      }

      const opponent = player === "red" ? "black" : "red";
      if (!room.players[opponent]?.connected) {
        ackFailure(ack, "Wait for your opponent to reconnect.");
        return;
      }

      if (room.game.status.phase !== "playing") {
        ackFailure(ack, "That game is already over.");
        return;
      }

      if (room.game.currentPlayer !== player) {
        ackFailure(ack, "It is not your turn.");
        return;
      }

      try {
        room.game = applyMove(room.game, moveId);
        room.rematchVotes.clear();
        bumpRevision(room);
        ackSuccess(ack, null);
        broadcastRoom(room);
      } catch {
        ackFailure(ack, "That move is no longer legal.");
      }
    });

    socket.on("room:end-jump", (ack) => {
      const membership = getMembership(socket);
      if (!membership) {
        ackFailure(ack, "You are not in a game.");
        return;
      }

      const { room, player } = membership;
      if (room.game.currentPlayer !== player) {
        ackFailure(ack, "It is not your turn.");
        return;
      }

      try {
        room.game = endOptionalJump(room.game);
        bumpRevision(room);
        ackSuccess(ack, null);
        broadcastRoom(room);
      } catch {
        ackFailure(ack, "There is no optional jump to end.");
      }
    });

    socket.on("room:resign", (ack) => {
      const membership = getMembership(socket);
      if (!membership) {
        ackFailure(ack, "You are not in a game.");
        return;
      }

      const { room, player } = membership;
      if (room.game.status.phase !== "playing") {
        ackFailure(ack, "That game is already over.");
        return;
      }

      room.game = resignGame(room.game, player);
      room.rematchVotes.clear();
      bumpRevision(room);
      ackSuccess(ack, null);
      broadcastRoom(room);
    });

    socket.on("room:rematch", (ack) => {
      const membership = getMembership(socket);
      if (!membership) {
        ackFailure(ack, "You are not in a game.");
        return;
      }

      const { room, player } = membership;
      if (room.game.status.phase !== "won") {
        ackFailure(ack, "The current game is not finished.");
        return;
      }

      const opponent = player === "red" ? "black" : "red";
      if (!room.players[opponent]?.connected) {
        ackFailure(ack, "Your opponent is no longer in the room.");
        return;
      }

      room.rematchVotes.add(player);
      if (room.rematchVotes.size === 2) {
        room.game = createInitialState(room.rules);
        room.rematchVotes.clear();
      }

      bumpRevision(room);
      ackSuccess(ack, null);
      broadcastRoom(room);
    });

    socket.on("room:chat", (message, ack) => {
      const membership = getMembership(socket);
      if (!membership) {
        ackFailure(ack, "You are not in a room.");
        return;
      }

      const { room } = membership;

      const text = normalizeChatMessage(message);
      if (!isQuickChatMessage(text)) {
        ackFailure(ack, "Choose one of the quick messages.");
        return;
      }

      const now = Date.now();
      if (socket.data.lastChatAt && now - socket.data.lastChatAt < CHAT_COOLDOWN_MS) {
        ackFailure(ack, "Please wait a moment before sending another message.");
        return;
      }

      socket.data.lastChatAt = now;
      room.chat.push({
        id: randomUUID(),
        player: membership.player,
        text,
        sentAt: now
      });
      if (room.chat.length > MAX_CHAT_MESSAGES) {
        room.chat.splice(0, room.chat.length - MAX_CHAT_MESSAGES);
      }

      bumpRevision(room);
      ackSuccess(ack, null);
      broadcastRoom(room);
    });

    socket.on("room:update-rules", (rules, ack) => {
      const membership = getMembership(socket);
      if (!membership) {
        ackFailure(ack, "You are not in a room.");
        return;
      }

      const { room, player } = membership;
      if (!room.players[player]?.isHost) {
        ackFailure(ack, "Only the room host can change the rules.");
        return;
      }

      if (room.players.red && room.players.black) {
        ackFailure(ack, "Rules cannot change after another player joins.");
        return;
      }

      room.rules = normalizeRules(rules);
      room.game = createInitialState(room.rules);
      bumpRevision(room);
      ackSuccess(ack, null);
      broadcastRoom(room);
    });

    socket.on("room:leave", (ack) => {
      leaveCurrentRoom(socket, true);
      ackSuccess(ack, null);
    });

    socket.on("matchmaking:join", (payload, ack) => {
      leaveCurrentRoom(socket, false);
      removeFromQueue(socket.id);

      const opponentIndex = queue.findIndex(
        (entry) =>
          entry.socketId !== socket.id &&
          entry.rules.forceCheckerCaptures ===
            payload.rules.forceCheckerCaptures &&
          io.sockets.sockets.has(entry.socketId)
      );

      if (opponentIndex === -1) {
        queue.push({
          socketId: socket.id,
          name: normalizeName(payload.name),
          playerId: isPlayerId(payload.playerId) ? payload.playerId : null,
          rules: normalizeRules(payload.rules)
        });
        socket.data.queued = true;
        ackSuccess(ack, { queued: true });
        return;
      }

      const opponent = queue.splice(opponentIndex, 1)[0];
      const opponentSocket = io.sockets.sockets.get(opponent.socketId) as
        | GameSocket
        | undefined;

      if (!opponentSocket) {
        queue.push({
          socketId: socket.id,
          name: normalizeName(payload.name),
          playerId: isPlayerId(payload.playerId) ? payload.playerId : null,
          rules: normalizeRules(payload.rules)
        });
        socket.data.queued = true;
        ackSuccess(ack, { queued: true });
        return;
      }

      // Quick match assigns colors at random; Red still moves first.
      const room = createRoom(rooms, payload.rules);
      const waitingColor: Player = Math.random() < 0.5 ? "red" : "black";
      const joiningColor: Player = waitingColor === "red" ? "black" : "red";
      seatPlayer(room, opponentSocket, waitingColor, opponent.name, opponent.playerId, true);
      seatPlayer(room, socket, joiningColor, payload.name, payload.playerId, false);
      rooms.set(room.code, room);
      opponentSocket.data.queued = false;
      socket.data.queued = false;
      bumpRevision(room);

      ackSuccess(ack, { queued: false });
      opponentSocket.emit("matchmaking:matched", connectionFor(room, waitingColor));
      socket.emit("matchmaking:matched", connectionFor(room, joiningColor));
      broadcastRoom(room);
    });

    socket.on("matchmaking:leave", (ack) => {
      removeFromQueue(socket.id);
      socket.data.queued = false;
      ackSuccess(ack, null);
    });

    socket.on("disconnect", () => {
      removeFromQueue(socket.id);
      const membership = getMembership(socket);
      if (!membership) {
        return;
      }

      const seat = membership.room.players[membership.player];
      if (seat?.socketId === socket.id) {
        seat.socketId = null;
        seat.connected = false;
        scheduleDisconnectDeadline(membership.room, membership.player);
        bumpRevision(membership.room);
        broadcastRoom(membership.room);
      }
    });
  });

  function removeFromQueue(socketId: string) {
    const index = queue.findIndex((entry) => entry.socketId === socketId);
    if (index !== -1) {
      queue.splice(index, 1);
    }
  }

  function getMembership(socket: GameSocket) {
    const session = socket.data.session;
    if (!session) {
      return null;
    }

    const room = rooms.get(session.roomCode);
    const seat = room?.players[session.player];
    if (
      !room ||
      !seat ||
      seat.reconnectToken !== session.reconnectToken ||
      seat.socketId !== socket.id
    ) {
      socket.data.session = undefined;
      return null;
    }

    return { room, player: session.player };
  }

  function leaveCurrentRoom(socket: GameSocket, voluntary: boolean) {
    const membership = getMembership(socket);
    if (!membership) {
      return;
    }

    const { room, player } = membership;
    clearDisconnectDeadline(room, player);
    socket.leave(room.code);
    socket.data.session = undefined;

    // Leaving a room nobody else has joined closes it.
    if (!room.players.red || !room.players.black) {
      deleteRoom(room);
      socket.emit("room:closed", "The room was closed.");
      return;
    }

    const seat = room.players[player];
    if (voluntary && seat) {
      if (room.game.status.phase === "playing") {
        room.game = resignGame(room.game, player);
      }
      seat.connected = false;
      seat.socketId = null;
      seat.reconnectToken = randomUUID();
      room.rematchVotes.delete(player);
      bumpRevision(room);
      broadcastRoom(room);

      if (!room.players.red?.connected && !room.players.black?.connected) {
        deleteRoom(room);
      }
      return;
    }

    room.players[player] = null;
    room.rematchVotes.delete(player);
    bumpRevision(room);
    broadcastRoom(room);
  }

  function scheduleDisconnectDeadline(room: GameRoom, player: Player) {
    clearDisconnectDeadline(room, player);
    if (room.game.status.phase !== "playing") {
      return;
    }

    room.disconnectDeadlines[player] = Date.now() + disconnectGraceMs;
    room.disconnectTimers[player] = setTimeout(() => {
      room.disconnectTimers[player] = null;
      room.disconnectDeadlines[player] = null;

      const seat = room.players[player];
      if (seat?.connected || room.game.status.phase !== "playing") {
        return;
      }

      room.game = resignGame(room.game, player);
      room.rematchVotes.clear();
      bumpRevision(room);
      broadcastRoom(room);

      if (!room.players.red?.connected && !room.players.black?.connected) {
        deleteRoom(room);
      }
    }, disconnectGraceMs);
  }

  function clearDisconnectDeadline(room: GameRoom, player: Player) {
    const timer = room.disconnectTimers[player];
    if (timer) clearTimeout(timer);
    room.disconnectTimers[player] = null;
    room.disconnectDeadlines[player] = null;
  }

  function deleteRoom(room: GameRoom) {
    clearDisconnectDeadline(room, "red");
    clearDisconnectDeadline(room, "black");
    rooms.delete(room.code);
  }

  function broadcastRoom(room: GameRoom) {
    io.to(room.code).emit("room:state", snapshotRoom(room));
  }

  return {
    io,
    httpServer,
    rooms,
    listen(
      port = Number(process.env.PORT) || DEFAULT_PORT,
      host = process.env.HOST || "127.0.0.1"
    ) {
      return new Promise<number>((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(port, host, () => {
          httpServer.off("error", reject);
          const address = httpServer.address();
          resolve(typeof address === "object" && address ? address.port : port);
        });
      });
    },
    close() {
      return new Promise<void>((resolve) => {
        for (const room of rooms.values()) {
          clearDisconnectDeadline(room, "red");
          clearDisconnectDeadline(room, "black");
        }
        io.close(() => resolve());
      });
    }
  };
}

function createHealthServer() {
  return createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, service: "knight-checkers" }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false }));
  });
}

function createRoom(rooms: Map<string, GameRoom>, rules: GameRules): GameRoom {
  let code = createRoomCode();
  while (rooms.has(code)) {
    code = createRoomCode();
  }

  const normalizedRules = normalizeRules(rules);
  return {
    code,
    rules: normalizedRules,
    game: createInitialState(normalizedRules),
    players: { red: null, black: null },
    rematchVotes: new Set<Player>(),
    chat: [],
    disconnectDeadlines: { red: null, black: null },
    disconnectTimers: { red: null, black: null },
    revision: 1
  };
}

function seatPlayer(
  room: GameRoom,
  socket: GameSocket,
  player: Player,
  name: string,
  playerId: unknown,
  isHost: boolean
): RoomConnection {
  const reconnectToken = randomUUID();
  room.players[player] = {
    name: normalizeName(name),
    player,
    connected: true,
    isHost,
    reconnectToken,
    socketId: socket.id,
    playerId: isPlayerId(playerId) ? playerId : null
  };

  socket.data.session = {
    roomCode: room.code,
    player,
    reconnectToken
  };
  socket.join(room.code);
  return connectionFor(room, player);
}

function connectionFor(room: GameRoom, player: Player): RoomConnection {
  return {
    session: sessionFor(room, player),
    snapshot: snapshotRoom(room)
  };
}

function sessionFor(room: GameRoom, player: Player): PlayerSession {
  const seat = room.players[player];
  if (!seat) {
    throw new Error("Cannot create a session for an empty seat.");
  }

  return {
    roomCode: room.code,
    player,
    reconnectToken: seat.reconnectToken
  };
}

function snapshotRoom(room: GameRoom): RoomSnapshot {
  return {
    code: room.code,
    stage: room.players.red && room.players.black
      ? room.game.status.phase === "won"
        ? "finished"
        : "playing"
      : "waiting",
    rules: room.rules,
    game: room.game,
    players: {
      red: publicSeat(room.players.red),
      black: publicSeat(room.players.black)
    },
    rematchVotes: [...room.rematchVotes],
    chat: room.chat,
    disconnectDeadlines: room.disconnectDeadlines,
    revision: room.revision
  };
}

function publicSeat(seat: RoomSeat | null): PublicRoomPlayer | null {
  if (!seat) {
    return null;
  }

  return {
    name: seat.name,
    player: seat.player,
    connected: seat.connected,
    isHost: seat.isHost
  };
}

function bumpRevision(room: GameRoom) {
  room.revision += 1;
}

function normalizeRules(rules: GameRules): GameRules {
  return { forceCheckerCaptures: Boolean(rules.forceCheckerCaptures) };
}

// Older clients send no color and expect to host as Red.
function resolveColor(choice: unknown): Player {
  if (choice === "random") return Math.random() < 0.5 ? "red" : "black";
  return choice === "black" ? "black" : "red";
}

// Only generated names are shown to other players; anything else becomes "Guest".
function normalizeName(name: unknown) {
  return typeof name === "string" && isGeneratedName(name) ? name : "Guest";
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function normalizeChatMessage(message: string) {
  return message.trim().replace(/\s+/g, " ").slice(0, MAX_CHAT_LENGTH);
}

function createRoomCode() {
  return Array.from({ length: 6 }, () =>
    ROOM_ALPHABET.charAt(Math.floor(Math.random() * ROOM_ALPHABET.length))
  ).join("");
}

function ackSuccess<T>(ack: ServerAck<T>, data: T) {
  ack({ ok: true, data });
}

function ackFailure<T>(ack: ServerAck<T>, message: string) {
  ack({ ok: false, message });
}

const isDirectRun =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  const gameServer = createGameServer();
  const host = process.env.HOST || "127.0.0.1";

  function shutDown() {
    gameServer.close().finally(() => process.exit(0));
  }

  process.once("SIGTERM", shutDown);
  process.once("SIGINT", shutDown);
  gameServer
    .listen()
    .then((port) => {
      process.stdout.write(`Knight Checkers game server listening on ${host}:${port}\n`);
    })
    .catch((error: unknown) => {
      process.stderr.write(`${String(error)}\n`);
      process.exitCode = 1;
    });
}
