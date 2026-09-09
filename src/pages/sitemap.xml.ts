// Sitemap for pixydust.com.
//
// Only publicly reachable, indexable pages belong here. Two rules to keep in
// mind when editing:
//  • No auth-gated routes (/account, /gallery, /invite) — they 302 to sign-in,
//    and a sitemap full of redirects is treated as a quality signal.
//  • No /studio/* template pages — robots.txt disallows that prefix.
// This list previously advertised /explore and /explore/<category>, neither of
// which is a route: 24 of the 25 URLs Google was given returned 404.
export const prerender = false;
import type { APIContext } from "astro";

const DOMAIN = "https://pixydust.com";

const PAGES: { loc: string; priority: string; changefreq: string }[] = [
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/trending", priority: "0.9", changefreq: "daily" },
  { loc: "/presets", priority: "0.8", changefreq: "weekly" },
  { loc: "/hair", priority: "0.8", changefreq: "weekly" },
  { loc: "/beauty", priority: "0.8", changefreq: "weekly" },
  { loc: "/avatar", priority: "0.8", changefreq: "weekly" },
  { loc: "/video", priority: "0.8", changefreq: "weekly" },
  { loc: "/shoots", priority: "0.7", changefreq: "weekly" },
  { loc: "/credits", priority: "0.6", changefreq: "monthly" },
  { loc: "/brand", priority: "0.4", changefreq: "monthly" },
  { loc: "/legal/terms", priority: "0.3", changefreq: "monthly" },
  { loc: "/legal/privacy", priority: "0.3", changefreq: "monthly" },
  { loc: "/legal/acceptable-use", priority: "0.3", changefreq: "monthly" },
];

export async function GET(_ctx: APIContext) {
  const now = new Date().toISOString().split("T")[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(
  (p) => `  <url>
    <loc>${DOMAIN}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
