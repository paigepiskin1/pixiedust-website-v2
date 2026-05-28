/**
 * Generates the default OG share image (1200×630) and uploads to Bunny + public/.
 */
import { Resvg } from "@resvg/resvg-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BUNNY_ZONE = "pixiecdn";
const BUNNY_KEY = "3a6d5162-f894-43bb-a826ff078ea6-d1fc-44d5";
const CDN_BASE = "https://pixiecdn.b-cdn.net";

const OG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0d0d12"/>
      <stop offset="100%" stop-color="#1a0a2e"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ec4899" stop-opacity="0.15"/>
    </linearGradient>
    <linearGradient id="icon-bg" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <linearGradient id="text-grad" x1="180" y1="0" x2="780" y2="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#f472b6"/>
    </linearGradient>
    <radialGradient id="radial" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#0d0d12" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#radial)"/>

  <!-- Subtle grid lines -->
  <line x1="0" y1="210" x2="1200" y2="210" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
  <line x1="0" y1="420" x2="1200" y2="420" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
  <line x1="400" y1="0" x2="400" y2="630" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
  <line x1="800" y1="0" x2="800" y2="630" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>

  <!-- Large decorative sparkles (background) -->
  <path d="M980 120 C983 145 983 145 1008 158 C983 171 983 171 980 196 C977 171 977 171 952 158 C977 145 977 145 980 120 Z" fill="#a855f7" opacity="0.2"/>
  <path d="M220 480 C222 495 222 495 237 502 C222 509 222 509 220 524 C218 509 218 509 203 502 C218 495 218 495 220 480 Z" fill="#ec4899" opacity="0.25"/>
  <path d="M1100 400 C1101 408 1101 408 1109 412 C1101 416 1101 416 1100 424 C1099 416 1099 416 1091 412 C1099 408 1099 408 1100 400 Z" fill="#c084fc" opacity="0.35"/>

  <!-- Floating dot particles -->
  <circle cx="950" cy="200" r="3" fill="#a855f7" opacity="0.4"/>
  <circle cx="1050" cy="320" r="2" fill="#ec4899" opacity="0.3"/>
  <circle cx="150" cy="150" r="2.5" fill="#7c3aed" opacity="0.35"/>
  <circle cx="300" cy="520" r="2" fill="#c084fc" opacity="0.3"/>
  <circle cx="1120" cy="500" r="3" fill="#f472b6" opacity="0.3"/>

  <!-- Center content group -->
  <!-- Icon mark (96×96) centered top -->
  <rect x="552" y="155" width="96" height="96" rx="26" fill="url(#icon-bg)"/>
  <path d="M600 171 C604 191 604 191 632 203 C604 215 604 215 600 235 C596 215 596 215 568 203 C596 191 596 191 600 171 Z" fill="white"/>
  <circle cx="626" cy="178" r="4.4" fill="white" opacity="0.75"/>
  <circle cx="574" cy="228" r="3" fill="white" opacity="0.55"/>

  <!-- Wordmark -->
  <text x="600" y="320"
    text-anchor="middle"
    font-family="system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    font-weight="800"
    font-size="72"
    letter-spacing="-2"
    fill="url(#text-grad)">PixieDust</text>

  <!-- Tagline -->
  <text x="600" y="376"
    text-anchor="middle"
    font-family="system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif"
    font-weight="400"
    font-size="26"
    letter-spacing="0"
    fill="rgba(255,255,255,0.5)">AI image &amp; video generator — 150+ templates</text>

  <!-- Bottom domain pill -->
  <rect x="488" y="498" width="224" height="42" rx="21" fill="rgba(124,58,237,0.2)" stroke="rgba(124,58,237,0.4)" stroke-width="1"/>
  <text x="600" y="525"
    text-anchor="middle"
    font-family="system-ui, -apple-system, monospace"
    font-weight="500"
    font-size="18"
    fill="rgba(192,132,252,0.9)">pixiedustapp.com</text>
</svg>`;

async function main() {
  console.log("Generating OG default image (1200×630)…");

  const resvg = new Resvg(OG_SVG, { fitTo: { mode: "width", value: 1200 } });
  const png = resvg.render().asPng();

  // Save locally as public/og-default.png
  fs.writeFileSync(path.join(ROOT, "public", "og-default.png"), png);
  console.log("  ✓ Saved public/og-default.png");

  // Upload to Bunny
  const res = await fetch(`https://storage.bunnycdn.com/${BUNNY_ZONE}/brand/og-default.png`, {
    method: "PUT",
    headers: { AccessKey: BUNNY_KEY, "Content-Type": "image/png" },
    body: png,
  });
  if (!res.ok) throw new Error(`Bunny upload failed (${res.status})`);
  console.log(`  ✓ Uploaded → ${CDN_BASE}/brand/og-default.png`);
}

main().catch(console.error);
