import type { Player } from "../game";
import type { RoomSnapshot } from "./protocol";

// The app-store build shows no free-form text from other players (App Store guideline 1.2,
// user-generated content). Native players chat with these phrases only, and anything else a
// web player types is hidden from them, including display names.
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
