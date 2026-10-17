import { chooseBotAction, type BotAction, type BotLevel } from "./bot";
import type { GameState } from "./game";

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, (action: BotAction | null) => void>();

function getWorker() {
  if (worker || typeof Worker === "undefined") return worker;
  try {
    worker = new Worker(new URL("./botWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; action: BotAction | null }>) => {
      pending.get(event.data.id)?.(event.data.action);
      pending.delete(event.data.id);
    };
  } catch {
    worker = null;
  }
  return worker;
}

// Asks the bot for its next action. Falls back to the main thread where workers are unavailable.
export function requestBotAction(state: GameState, level: BotLevel): Promise<BotAction | null> {
  const activeWorker = getWorker();
  if (!activeWorker) return Promise.resolve(chooseBotAction(state, level));
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    activeWorker.postMessage({ id, state, level });
  });
}
