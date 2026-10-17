// Lays every style's sprites out on board-colored tiles so they can be judged side by side.
import sharp from "sharp";
import { existsSync } from "node:fs";

const styles = process.argv.slice(2).length ? process.argv.slice(2) : ["lacquer", "wood", "toon", "faceted", "metal"];
const tile = 220;
const cols = ["knight-red", "knight-black", "knight-gray", "crown@red", "crown@black"];
const width = tile * cols.length;
const height = tile * styles.length;

const checker = (fill, edge) => `<svg xmlns="http://www.w3.org/2000/svg" width="${tile}" height="${tile}">
  <defs><radialGradient id="g" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${fill}"/><stop offset="1" stop-color="${edge}"/></radialGradient></defs>
  <circle cx="${tile / 2}" cy="${tile / 2 + 4}" r="${tile * 0.4}" fill="rgba(0,0,0,.35)"/>
  <circle cx="${tile / 2}" cy="${tile / 2}" r="${tile * 0.4}" fill="url(#g)"/>
  <circle cx="${tile / 2}" cy="${tile / 2}" r="${tile * 0.31}" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="3"/>
</svg>`;

const layers = [];
const board = [];
styles.forEach((style, row) => {
  cols.forEach((col, i) => {
    const x = i * tile, y = row * tile;
    board.push(`<rect x="${x}" y="${y}" width="${tile}" height="${tile}" fill="${(row + i) % 2 ? "#2f6b57" : "#dfe3dc"}"/>`);
    const [name, on] = col.split("@");
    if (on) {
      layers.push({ input: Buffer.from(checker(on === "red" ? "#d0434a" : "#3b3f45", on === "red" ? "#7d1a1f" : "#111214")), left: x, top: y });
    }
    const file = `art/out/${style}-${name}.png`;
    if (!existsSync(file)) return;
    const scale = on ? 0.5 : 0.9;
    layers.push({ file, x, y, scale });
  });
});

const composites = [];
for (const layer of layers) {
  if (layer.input) { composites.push(layer); continue; }
  const size = Math.round(tile * layer.scale);
  const offset = Math.round((tile - size) / 2);
  composites.push({ input: await sharp(layer.file).resize(size, size).toBuffer(), left: layer.x + offset, top: layer.y + offset });
}

await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${board.join("")}</svg>`))
  .composite(composites)
  .png()
  .toFile("art/out/contact-sheet.png");
console.log("art/out/contact-sheet.png");
