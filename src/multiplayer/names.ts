// Generated display names. Players never type a name, so no one can show offensive text to a
// stranger, and the server only accepts names built from these lists.
const ADJECTIVES = [
  "Swift", "Brave", "Clever", "Quiet", "Lucky", "Bold", "Calm", "Eager", "Gentle", "Happy",
  "Jolly", "Keen", "Lively", "Mighty", "Noble", "Proud", "Quick", "Rapid", "Sly", "Steady",
  "Sunny", "Witty", "Zesty", "Daring", "Fierce", "Grand", "Humble", "Merry", "Nimble", "Plucky",
  "Royal", "Silent", "Spry", "Stout", "Tidy", "Valiant", "Wise", "Bright", "Cosmic", "Frosty"
];
const ANIMALS = [
  "Falcon", "Otter", "Badger", "Fox", "Heron", "Lynx", "Panda", "Raven", "Tiger", "Wolf",
  "Bison", "Cobra", "Dingo", "Eagle", "Ferret", "Gecko", "Hawk", "Ibex", "Jaguar", "Koala",
  "Lemur", "Moose", "Newt", "Owl", "Puffin", "Quail", "Robin", "Seal", "Toucan", "Walrus",
  "Yak", "Zebra", "Beaver", "Crane", "Dolphin", "Finch", "Gopher", "Hare", "Marten", "Stallion"
];

const NAME_PATTERN = new RegExp(`^(${ADJECTIVES.join("|")})(${ANIMALS.join("|")})([1-9][0-9])$`);

export function generateDisplayName(random: () => number = Math.random) {
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)];
  return `${pick(ADJECTIVES)}${pick(ANIMALS)}${10 + Math.floor(random() * 90)}`;
}

export function isGeneratedName(name: string) {
  return NAME_PATTERN.test(name);
}

// Stable random player IDs, kept for ratings and profiles later.
const PLAYER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isPlayerId(value: unknown): value is string {
  return typeof value === "string" && PLAYER_ID_PATTERN.test(value);
}
