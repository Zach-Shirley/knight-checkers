import { io, type Socket } from "socket.io-client";
import { isNativeApp, PRODUCTION_GAME_SERVER_URL } from "../platform";
import type { ClientToServerEvents, ServerToClientEvents } from "./protocol";

export type MultiplayerSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

const gameServerUrl =
  import.meta.env.VITE_GAME_SERVER_URL ??
  (isNativeApp ? PRODUCTION_GAME_SERVER_URL : "http://127.0.0.1:4175");

let socket: MultiplayerSocket | null = null;

export function getMultiplayerSocket() {
  if (!socket) {
    socket = io(gameServerUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3_000,
      timeout: 6_000
    });
  }

  return socket;
}
