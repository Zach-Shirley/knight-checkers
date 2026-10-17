// End-to-end check for bot games, playing a bot during quick match, and generated names.
// Needs the same servers as scripts/store-screenshots.mjs. Run: node scripts/e2e-bots.mjs
import { chromium } from "playwright";

const APP = "http://localhost:4174";
const out = "art/out";
const browser = await chromium.launch();
const device = { viewport: { width: 440, height: 956 }, deviceScaleFactor: 2 };
const errors = [];
const watch = (page, label) => page.on("console", (m) => m.type() === "error" && errors.push(`${label}: ${m.text()}`));
const square = (page, name) => page.locator(`button[aria-label^="${name},"]`);
const moveCount = (page) => page.locator(".moves-heading span").innerText().then(Number);
const check = (ok, message) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${message}`);
  if (!ok) process.exitCode = 1;
};

// 1. Bot game from the home screen
const a = await (await browser.newContext(device)).newPage();
watch(a, "A");
await a.goto(APP);
await a.getByText("Play a Bot").click();
await a.screenshot({ path: `${out}/e2e-bot-dialog.png` });
await a.getByRole("radio", { name: /Hard/ }).click();
await a.getByRole("button", { name: "Start game" }).click();
check(a.url().endsWith("/bot"), "bot game opens at /bot");
check((await a.locator(".game-panel-header strong").innerText()) === "Hard bot", "panel names the hard bot");
await square(a, "c3").click();
await square(a, "d4").click();
await a.waitForFunction(() => Number(document.querySelector(".moves-heading span")?.textContent) >= 2, null, { timeout: 8000 });
check((await moveCount(a)) === 2, "bot replies to the first move");
await a.waitForTimeout(800);
await a.screenshot({ path: `${out}/e2e-bot-game.png` });
await a.getByRole("button", { name: "Undo" }).click();
check((await moveCount(a)) === 0, "undo removes the player's move and the bot's reply");

// Play a few more turns to make sure the bot keeps answering, including captures.
for (let turn = 0; turn < 6; turn++) {
  const before = await moveCount(a);
  let target = null;
  const reds = await a.locator('button[aria-label*="Red "]:not([aria-label*="resting"])').evaluateAll((els) =>
    els.map((el) => el.getAttribute("aria-label").split(",")[0])
  );
  for (const from of reds) {
    await square(a, from).click();
    await a.waitForTimeout(60);
    const dest = a.locator('button[aria-label*="destination"]');
    if (await dest.count()) {
      target = (await dest.first().getAttribute("aria-label")).split(",")[0];
      break;
    }
  }
  if (!target) break;
  await square(a, target).click();
  // Finish any multi-jump the human started.
  for (let i = 0; i < 4; i++) {
    const more = a.locator('button[aria-label*="destination"]');
    if ((await more.count()) === 0 || !(await a.locator(".turn-status p").innerText()).startsWith("Red")) break;
    await more.first().click();
  }
  await a.waitForFunction((n) => {
    const count = Number(document.querySelector(".moves-heading span")?.textContent);
    const status = document.querySelector(".turn-status p")?.textContent ?? "";
    return (count > n + 1 && status.startsWith("Red")) || status === "Game over";
  }, before, { timeout: 10000 });
}
check((await moveCount(a)) >= 12, `bot kept answering over several turns (${await moveCount(a)} moves logged)`);

// 2. Quick match with a bot while waiting
await a.goto(`${APP}/multiplayer`);
await a.waitForSelector("text=Playing as");
const nameA = await a.locator(".playing-as strong").innerText();
check(/^[A-Z][a-z]+[A-Z][a-z]+\d\d$/.test(nameA), `player gets a generated name (${nameA})`);
await a.reload();
await a.waitForSelector("text=Playing as");
check((await a.locator(".playing-as strong").innerText()) === nameA, "generated name survives a reload");
await a.getByRole("button", { name: "Find match" }).click();
await a.waitForSelector("text=Looking for a player");
await a.screenshot({ path: `${out}/e2e-queue.png` });
await a.getByRole("button", { name: "Play while I wait" }).click();
await a.waitForSelector("text=Still searching for a match");
await square(a, "c3").click();
await square(a, "d4").click();
await a.waitForFunction(() => Number(document.querySelector(".moves-heading span")?.textContent) >= 2, null, { timeout: 8000 });
check(true, "bot game runs while quick match searches");

const b = await (await browser.newContext(device)).newPage();
watch(b, "B");
await b.goto(`${APP}/multiplayer`);
await b.waitForSelector("text=Playing as");
const nameB = await b.locator(".playing-as strong").innerText();
await b.getByRole("button", { name: "Find match" }).click();
await a.waitForSelector("text=Match found! Your bot game was closed.", { timeout: 8000 });
await a.waitForSelector("text=Online match");
check(true, "a found match replaces the waiting bot game, with a notice");
check(await a.getByText(nameB).first().isVisible(), `opponent shows by generated name (${nameB})`);
await a.screenshot({ path: `${out}/e2e-matched.png` });

// 3. Play a bot instead
const c = await (await browser.newContext(device)).newPage();
watch(c, "C");
await c.goto(`${APP}/multiplayer`);
await c.waitForSelector("text=Playing as");
await c.getByRole("button", { name: "Find match" }).click();
await c.waitForSelector("text=Looking for a player");
await c.getByRole("button", { name: "Play a bot instead" }).click();
await c.waitForURL(/\/bot$/);
check((await c.locator(".game-panel-header strong").innerText()) === "Medium bot", "play a bot instead leaves the queue and opens a bot game");

// 4. Color choice: playing the bot as Black flips the board and the bot (Red) opens.
const d = await (await browser.newContext(device)).newPage();
watch(d, "D");
await d.goto(APP);
await d.getByText("Play a Bot").click();
await d.getByRole("radio", { name: "Black" }).click();
await d.getByRole("button", { name: "Start game" }).click();
await d.waitForFunction(() => Number(document.querySelector(".moves-heading span")?.textContent) >= 1, null, { timeout: 8000 });
const firstLabel = await d.locator(".board button").first().getAttribute("aria-label");
check(firstLabel.startsWith("h1,"), `board is flipped for Black (top-left square is ${firstLabel.split(",")[0]})`);
check((await d.locator(".player-bar").last().innerText()).includes("You"), "your bar is at the bottom");
check((await d.locator(".move-list li").first().innerText()).includes("Red"), "the bot, playing Red, moves first");
await d.screenshot({ path: `${out}/e2e-bot-black.png` });

// 5. Private room: the creator picks Black, the joiner gets Red and moves first.
const host = await (await browser.newContext(device)).newPage();
watch(host, "host");
await host.goto(`${APP}/multiplayer`);
await host.waitForSelector("text=Playing as");
await host.getByRole("radio", { name: "Black" }).click();
await host.getByRole("button", { name: "Create private room" }).click();
await host.waitForSelector("text=Waiting for an opponent");
const code = (await host.locator(".room-code-display span").innerText()).trim();
const guest = await (await browser.newContext(device)).newPage();
watch(guest, "guest");
await guest.goto(`${APP}/multiplayer`);
await guest.waitForSelector("text=Playing as");
await guest.getByText("Join room", { exact: true }).first().click();
await guest.getByPlaceholder("ABC123").fill(code);
await guest.locator("form.lobby-form button[type=submit]").click();
await guest.waitForSelector("text=Your move");
check(true, "joiner of a Black-hosted room plays Red and moves first");
await host.waitForSelector("text=Online match");
check((await host.locator(".player-bar").last().innerText()).includes("Black"), "host sees themselves as Black at the bottom");
await host.screenshot({ path: `${out}/e2e-room-black.png` });

check(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await browser.close();
