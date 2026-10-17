// Copies one style's studio renders into the app as right-sized sprites in src/assets/pieces/.
// Usage: node art/export.mjs [style]   (default: lacquer, the shipped set)
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const style = process.argv[2] ?? "lacquer";
{
  const dir = "src/assets/pieces";
  mkdirSync(dir, { recursive: true });
  for (const side of ["red", "black", "gray"]) {
    // Trim the render's empty margin so the knight fills its square like the checkers do.
    await sharp(`art/out/${style}-knight-${side}.png`)
      .trim({ threshold: 1 })
      .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(`${dir}/knight-${side}.png`);
  }
  await sharp(`art/out/${style}-crown.png`).trim({ threshold: 1 }).resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toFile(`${dir}/crown.png`);
}
console.log(`exported ${style} to src/assets/pieces`);
