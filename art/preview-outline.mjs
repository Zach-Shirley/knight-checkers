import sharp from "sharp";
import { KNIGHT_HEAD, KNIGHT_EYE, CROWN } from "./shapes.mjs";
const e = KNIGHT_EYE;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 200 100">
<rect width="200" height="100" fill="#ddd"/>
<path d="${KNIGHT_HEAD}" fill="#b52f34" stroke="#3a0b0d" stroke-width="1.5" stroke-linejoin="round"/>
<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" transform="rotate(${e.rotate} ${e.cx} ${e.cy})" fill="#2a0607"/>
<g transform="translate(100 0)"><path d="${CROWN}" fill="#d4a63a" stroke="#4a3208" stroke-width="1.5" stroke-linejoin="round"/></g>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile("art/out/outline.png");
