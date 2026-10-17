// Adds a caption above each raw App Store screenshot: store/screenshots/raw → store/screenshots/framed.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const W = 1320;
const H = 2868;
const CAPTIONS = {
  "1-home": ["Checkers, plus a knight", "Classic rules with one chess knight per side"],
  "2-local-game": ["Pass & Play", "Two players, one phone"],
  "3-rules": ["Learn it in a minute", "The knight jumps, then rests a turn"],
  "4-online-room": ["Play a friend online", "Share a room code to start"],
  "5-online-game": ["Real-time matches", "Private rooms or quick match"]
};

mkdirSync("store/screenshots/framed", { recursive: true });
const shotWidth = 1100;
const shotHeight = Math.round((shotWidth * H) / W);
const radius = 64;
const mask = Buffer.from(`<svg width="${shotWidth}" height="${shotHeight}"><rect width="${shotWidth}" height="${shotHeight}" rx="${radius}"/></svg>`);

for (const [name, [title, subtitle]] of Object.entries(CAPTIONS)) {
  const shot = await sharp(`store/screenshots/raw/${name}.png`)
    .resize(shotWidth, shotHeight)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  const caption = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="420">
    <text x="${W / 2}" y="190" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="96" font-weight="700" fill="#f7f7f2">${title.replace("&", "&amp;")}</text>
    <text x="${W / 2}" y="290" text-anchor="middle" font-family="Segoe UI, Inter, sans-serif" font-size="54" fill="#b9c7c0">${subtitle}</text>
  </svg>`);
  await sharp({ create: { width: W, height: H, channels: 4, background: "#16352c" } })
    .composite([
      { input: caption, left: 0, top: 0 },
      { input: shot, left: Math.round((W - shotWidth) / 2), top: 400 }
    ])
    .flatten({ background: "#16352c" })
    .png()
    .toFile(`store/screenshots/framed/${name}.png`);
}
console.log("store/screenshots/framed/*.png");
