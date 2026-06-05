/**
 * Renders SVG logos to PNG at multiple sizes and uploads to Bunny CDN.
 * Run: node scripts/generate-logo-png.mjs
 */
import { Resvg } from "@resvg/resvg-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

// Bunny CDN config
const BUNNY_ZONE = "pixiecdn";
const BUNNY_KEY = "3a6d5162-f894-43bb-a826ff078ea6-d1fc-44d5";
const CDN_BASE = "https://pixiecdn.b-cdn.net";

// Space Grotesk Bold is required to render the "PixieDust" wordmark — resvg has
// no system fonts loaded, so without this the text rendered blank.
const FONT_PATH = path.join(__dirname, ".fonts", "SpaceGrotesk-700.ttf");
const FONT_FILES = fs.existsSync(FONT_PATH) ? [FONT_PATH] : [];
if (!FONT_FILES.length) {
  console.warn(`⚠ Wordmark font missing at ${FONT_PATH} — text will not render. ` +
    `Download it: curl -o "${FONT_PATH}" https://cdn.jsdelivr.net/fontsource/fonts/space-grotesk@latest/latin-700-normal.ttf`);
}

async function svgToPng(svgPath, widthPx) {
  const svg = fs.readFileSync(svgPath, "utf8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: widthPx },
    font: {
      loadSystemFonts: false, // avoids system font scanning delay
      fontFiles: FONT_FILES,
      defaultFontFamily: "Space Grotesk",
    },
  });
  const rendered = resvg.render();
  return rendered.asPng();
}

async function uploadToBunny(buffer, filename) {
  const url = `https://storage.bunnycdn.com/${BUNNY_ZONE}/${filename}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: BUNNY_KEY,
      "Content-Type": "image/png",
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Bunny upload failed (${res.status}): ${await res.text()}`);
  return `${CDN_BASE}/${filename}`;
}

const EXPORTS = [
  // [svgFile, outputName, widthPx]
  ["logo-icon.svg",  "brand/logo-icon-256.png",   256],
  ["logo-icon.svg",  "brand/logo-icon-512.png",   512],
  ["logo-icon.svg",  "brand/logo-icon-64.png",     64],
  ["logo.svg",       "brand/logo-440.png",         440],
  ["logo.svg",       "brand/logo-880.png",         880],
  ["logo-white.svg", "brand/logo-white-440.png",   440],
  ["logo-white.svg", "brand/logo-white-880.png",   880],
];

console.log("Generating PNGs and uploading to Bunny CDN…\n");
const urls = {};

for (const [svgName, dest, width] of EXPORTS) {
  const svgPath = path.join(PUBLIC, svgName);
  process.stdout.write(`  ${svgName} → ${dest} (${width}px) … `);
  try {
    const png = await svgToPng(svgPath, width);
    // Also save locally
    const localPath = path.join(PUBLIC, dest.replace("brand/", ""));
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, png);
    // Upload
    const cdnUrl = await uploadToBunny(png, dest);
    urls[dest] = cdnUrl;
    console.log(`✓\n    → ${cdnUrl}`);
  } catch (err) {
    console.log(`✗ ${err.message}`);
  }
}

console.log("\n\n── CDN URLs ──");
for (const [k, v] of Object.entries(urls)) {
  console.log(`${k}:\n  ${v}`);
}
console.log("\nDone.");
