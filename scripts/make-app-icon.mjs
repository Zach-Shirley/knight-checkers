// Renders the source images @capacitor/assets turns into every iOS/Android icon and splash size.
// Run: node scripts/make-app-icon.mjs && npx capacitor-assets generate
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const knight = (await readFile("src/assets/chess-knight-red.svg", "utf8"))
  .replace(/<\?xml[^>]*>/, "")
  .replace(/width="45" height="45"/, 'width="640" height="640"');

const dark = "#2f6b57";
const light = "#dfe3dc";

// A 2x2 board corner with the knight on top. Apple masks the corners itself, so no rounding here.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect width="512" height="512" fill="${light}"/>
  <rect x="512" width="512" height="512" fill="${dark}"/>
  <rect y="512" width="512" height="512" fill="${dark}"/>
  <rect x="512" y="512" width="512" height="512" fill="${light}"/>
  <g transform="translate(192 172)">${knight}</g>
</svg>`;

const splash = (background) => `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732">
  <rect width="2732" height="2732" fill="${background}"/>
  <g transform="translate(1046 1026)">${knight}</g>
</svg>`;

await sharp(Buffer.from(icon)).png().toFile("assets/icon-only.png");
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><g transform="translate(192 172)">${knight}</g></svg>`)).png().toFile("assets/icon-foreground.png");
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: dark } }).png().toFile("assets/icon-background.png");
await sharp(Buffer.from(splash("#111613"))).png().toFile("assets/splash.png");
await sharp(Buffer.from(splash("#111613"))).png().toFile("assets/splash-dark.png");
console.log("Wrote assets/*.png");
