import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/game";
import { QUICK_CHAT_MESSAGES, withoutFreeText } from "../src/multiplayer/nativeSafety";
import type { RoomSnapshot } from "../src/multiplayer/protocol";

function snapshotWith(chatTexts: string[]): RoomSnapshot {
  return {
    code: "ABC123",
    stage: "playing",
    rules: { forceCheckerCaptures: true },
    game: createInitialState(),
    players: {
      red: { name: "anything a stranger typed", player: "red", connected: true, isHost: true },
      black: null
    },
    rematchVotes: [],
    chat: chatTexts.map((text, index) => ({ id: String(index), player: "red", text, sentAt: index })),
    disconnectDeadlines: { red: null, black: null },
    revision: 1
  };
}

describe("app-store build text filter", () => {
  it("keeps quick-chat phrases and drops free-form chat", () => {
    const filtered = withoutFreeText(snapshotWith([QUICK_CHAT_MESSAGES[0], "free text from the web", QUICK_CHAT_MESSAGES[1]]));
    expect(filtered.chat.map((message) => message.text)).toEqual([QUICK_CHAT_MESSAGES[0], QUICK_CHAT_MESSAGES[1]]);
  });

  it("replaces typed display names with seat names and keeps empty seats empty", () => {
    const filtered = withoutFreeText(snapshotWith([]));
    expect(filtered.players.red?.name).toBe("Red player");
    expect(filtered.players.red?.connected).toBe(true);
    expect(filtered.players.black).toBeNull();
  });
});
