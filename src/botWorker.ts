// Runs the bot search off the main thread so animations stay smooth while it thinks.
import { chooseBotAction, type BotLevel } from "./bot";
import type { GameState } from "./game";

self.onmessage = (event: MessageEvent<{ id: number; state: GameState; level: BotLevel }>) => {
  const { id, state, level } = event.data;
  self.postMessage({ id, action: chooseBotAction(state, level) });
};
