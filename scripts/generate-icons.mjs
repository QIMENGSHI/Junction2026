// Keep installable app icons in sync with the vector used by Next.js.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const vector = await readFile(new URL("../app/icon.svg", import.meta.url));
await Promise.all([
  [192, "icon-192.png"],
  [512, "icon-512.png"],
  [180, "apple-touch-icon.png"],
].map(([size, name]) => sharp(vector).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/${name}`, import.meta.url)))));
// Maskable artwork stays inside the central safe area.
const mark = await sharp(vector).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#e9f5ed" } })
  .composite([{ input: mark, gravity: "centre" }]).png()
  .toFile(fileURLToPath(new URL("../public/maskable-512.png", import.meta.url)));
