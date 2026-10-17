// Screenshots the preview board in every piece set and lays them out in one comparison image.
// Needs the Vite dev server on :4174. Writes art/out/board-<set>.png and art/piece-sets.png.
import { chromium } from "playwright";
import sharp from "sharp";

const sets = ["classic", "lacquer", "wood", "toon", "faceted", "metal"];
const labels = {
  classic: "0 · Current (Wikimedia-based)",
  lacquer: "1 · Lacquered resin",
  wood: "2 · Carved wood",
  toon: "3 · Cel-shaded",
  faceted: "4 · Faceted",
  metal: "5 · Cast metal"
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 2 });
for (const set of sets) {
  await page.goto(`http://localhost:4174/art/board-preview.html?pieces=${set}`);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await page.locator(".board-frame").screenshot({ path: `art/out/board-${set}.png` });
}
await browser.close();

const tile = 640;
const label = 56;
const cols = 3;
const composites = [];
for (const [i, set] of sets.entries()) {
  const left = (i % cols) * tile;
  const top = Math.floor(i / cols) * (tile + label);
  composites.push({
    input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${label}"><text x="18" y="38" font-family="Segoe UI, sans-serif" font-size="28" font-weight="600" fill="#f2f2ee">${labels[set]}</text></svg>`),
    left,
    top
  });
  composites.push({ input: await sharp(`art/out/board-${set}.png`).resize(tile - 16, tile - 16).toBuffer(), left: left + 8, top: top + label });
}
await sharp({ create: { width: tile * cols, height: (tile + label) * 2, channels: 4, background: "#1b201e" } })
  .composite(composites)
  .png()
  .toFile("art/piece-sets.png");
console.log("art/piece-sets.png");
