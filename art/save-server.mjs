// Tiny local endpoint the studio page posts rendered PNGs to. Writes into art/out/.
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(import.meta.dirname, "out");
mkdirSync(outDir, { recursive: true });

createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.end();
  const name = new URL(req.url, "http://x").searchParams.get("name") ?? "";
  if (req.method !== "POST" || !/^[\w-]+\.png$/.test(name)) {
    res.statusCode = 400;
    return res.end("bad request");
  }
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    writeFileSync(join(outDir, name), Buffer.concat(chunks));
    res.end("ok");
  });
}).listen(4177, "127.0.0.1", () => console.log("save server on 4177"));
