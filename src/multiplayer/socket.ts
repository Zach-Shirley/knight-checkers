import { io, type Socket } from "socket.io-client";
import { PRODUCTION_GAME_SERVER_URL } from "../platform";
import type { ClientToServerEvents, ServerToClientEvents } from "./protocol";

export type MultiplayerSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

// Local development talks to the local server; every other host (the app shell, Vercel
// production and preview links, a phone on the LAN without an override) uses production.
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname) || window.location.hostname.endsWith(".sslip.io");
const gameServerUrl =
  import.meta.env.VITE_GAME_SERVER_URL ?? (isLocalHost ? "http://127.0.0.1:4175" : PRODUCTION_GAME_SERVER_URL);

let socket: MultiplayerSocket | null = null;

export function getMultiplayerSocket() {
  if (!socket) {
    socket = io(gameServerUrl, {
      autoConnect: false,
      // WebSocket first: it skips the HTTP long-polling handshake, so preview URLs and the
      // app shell connect even before the server's CORS list names their origin.
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3_000,
      timeout: 6_000
    });
  }

  return socket;
}
