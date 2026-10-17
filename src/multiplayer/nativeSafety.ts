import type { Player } from "../game";
import { isGeneratedName } from "./names";
import { isQuickChatMessage, type RoomSnapshot } from "./protocol";

// No player ever sees free-form text from another (App Store guideline 1.2, user-generated
// content). The server already allows only quick messages and generated names; this repeats
// the check on the client in case it talks to an older server.
const SEAT_NAMES: Record<Player, string> = { red: "Red player", black: "Black player" };

export function withoutFreeText(snapshot: RoomSnapshot): RoomSnapshot {
  const seat = (player: Player) => {
    const seated = snapshot.players[player];
    if (!seated) return null;
    return isGeneratedName(seated.name) ? seated : { ...seated, name: SEAT_NAMES[player] };
  };
  return {
    ...snapshot,
    players: { red: seat("red"), black: seat("black") },
    chat: snapshot.chat.filter((message) => isQuickChatMessage(message.text))
  };
}
