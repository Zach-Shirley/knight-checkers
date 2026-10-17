import { generateDisplayName, isGeneratedName, isPlayerId } from "./multiplayer/names";

export type PlayerIdentity = { id: string; name: string };

const STORAGE_KEY = "knight-checkers:identity";

// Each device gets one permanent identity: a random ID (for ratings and profiles later)
// and a generated display name.
export function getPlayerIdentity(): PlayerIdentity {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<PlayerIdentity> | null;
    if (stored && isPlayerId(stored.id) && typeof stored.name === "string" && isGeneratedName(stored.name)) {
      return { id: stored.id, name: stored.name };
    }
  } catch {
    // Unreadable storage: fall through and make a new identity.
  }
  const identity = { id: randomUuid(), name: generateDisplayName() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Private mode: the identity lasts for this page load only.
  }
  return identity;
}

// crypto.randomUUID only exists on secure (https) pages; getRandomValues works everywhere.
function randomUuid() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
