import type { Player } from "../game";
import { isQuickChatMessage, type RoomSnapshot } from "./protocol";

// The app-store build shows no free-form text from other players (App Store guideline 1.2,
// user-generated content). Chat is quick-messages-only everywhere, but this also hides display
// names and guards against servers that still accept free text.

const SEAT_NAMES: Record<Player, string> = { red: "Red player", black: "Black player" };

export function withoutFreeText(snapshot: RoomSnapshot): RoomSnapshot {
  return {
    ...snapshot,
    players: {
      red: snapshot.players.red && { ...snapshot.players.red, name: SEAT_NAMES.red },
      black: snapshot.players.black && { ...snapshot.players.black, name: SEAT_NAMES.black }
    },
    chat: snapshot.chat.filter((message) => isQuickChatMessage(message.text))
  };
}
