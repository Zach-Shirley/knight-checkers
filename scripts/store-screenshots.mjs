// Captures App Store screenshots (iPhone 6.9", 1320x2868) from the real app in app-shell mode.
// Needs: the Vite dev server on :4174 started with VITE_GAME_SERVER_URL=http://127.0.0.1:4175,
// and a local game server (PORT=4175 npx tsx server/game-server.ts).
// Usage: node scripts/store-screenshots.mjs [pieceSet]   → store/screenshots/raw/*.png
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const APP = "http://localhost:4174";
const pieceSet = process.argv[2] ?? "lacquer";
const outDir = "store/screenshots/raw";
mkdirSync(outDir, { recursive: true });

// A balanced mid-game reached by legal moves: a king each, both knights out, Black's knight resting.
const OPENING = [
  "e2-f4", "b6-c5", "g3-h4", "f6-e5", "h2-g3", "d7-f6", "f4-d3", "c5-d4", "e3-c5", "f6-d7",
  "d2-e3", "d6-b4", "b4-d2", "e1-c3", "d7-c5", "c1-d2", "a7-b6", "d3-f4", "c5-d7", "e3-d4",
  "g7-f6", "f4-d3", "f6-g5", "d4-f6", "d7-c5", "c3-b4", "c7-d6", "d3-c1", "b6-a5", "d2-c3",
  "c5-d7", "c1-e2", "h8-g7", "f6-h8", "d7-f6", "b4-c5", "d6-b4", "b4-d2", "e2-c1", "d2-e1"
];

const browser = await chromium.launch();
const device = { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

async function appPage() {
  const context = await browser.newContext(device);
  // Pretend to be the Android shell so the app-store build's UI is shown.
  await context.addInitScript(() => {
    window.androidBridge = { postMessage() {} };
  });
  const page = await context.newPage();
  await page.goto(`${APP}/?pieces=${pieceSet}`);
  return page;
}

const square = (page, name) => page.locator(`button[aria-label^="${name},"]`);
const settle = (page) => page.waitForTimeout(700);

async function shot(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`${outDir}/${name}.png`);
}

// 1. Home
const home = await appPage();
await shot(home, "1-home");

// 2. Local game in progress, with the red knight's moves showing
await home.getByText("Pass & Play").click();
await home.getByRole("button", { name: "Start game" }).click();
for (const move of OPENING) {
  const [from, to] = move.split("-");
  await square(home, from).click();
  await square(home, to).click();
  await home.waitForTimeout(450);
}
await square(home, "h8").click(); // Red's king, to show its moves
await shot(home, "2-local-game");

// 3. Rules
await home.goto(`${APP}/`);
await home.getByText("How to play").click();
await shot(home, "3-rules");

// 4. Online: the app player hosts a private room, a web player joins
const host = await appPage();
await host.goto(`${APP}/multiplayer`);
await host.getByRole("button", { name: "Create private room" }).click();
await host.waitForSelector("text=Waiting for an opponent");
await shot(host, "4-online-room");
const code = (await host.locator(".room-code-display span").innerText()).trim();

const guestContext = await browser.newContext(device);
const guest = await guestContext.newPage();
await guest.goto(`${APP}/multiplayer`);
await guest.getByText("Join room", { exact: true }).first().click();
await guest.getByPlaceholder("ABC123").fill(code);
await guest.locator("form.lobby-form button[type=submit]").click();
await host.waitForSelector("text=Your move");

// Ends on Red's turn with a capture available and Red's knight resting.
for (const [page, from, to] of [[host, "c3", "d4"], [guest, "b6", "a5"], [host, "e2", "f4"], [guest, "d6", "c5"]]) {
  await square(page, from).click();
  await square(page, to).click();
  await page.waitForTimeout(600);
}
await guest.locator("#room-chat-message").fill("Good luck!");
await guest.locator("form.chat-form button[type=submit]").click();
await host.getByRole("button", { name: "Thanks!" }).click();
await host.waitForTimeout(400);
await square(host, "d4").click();
await shot(host, "5-online-game");

await browser.close();
