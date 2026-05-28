export const prerender = false;
import type { APIContext } from "astro";

const DOMAIN = "https://pixiedustapp.com";

const STATIC_PAGES = [
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/explore", priority: "0.9", changefreq: "daily" },
  { loc: "/legal/privacy", priority: "0.3", changefreq: "monthly" },
  { loc: "/legal/terms", priority: "0.3", changefreq: "monthly" },
];

export async function GET({ locals }: APIContext) {
  const db = locals.runtime?.env?.DB;

  // Collect category slugs from live templates
  const categoryPages: { loc: string; priority: string; changefreq: string }[] = [];
  if (db) {
    try {
      const rows = await db
        .prepare("SELECT DISTINCT category FROM templates WHERE is_hidden = 0 AND category IS NOT NULL")
        .all<{ category: string }>();
      for (const { category } of rows.results ?? []) {
        if (category) {
          categoryPages.push({
            loc: `/explore/${encodeURIComponent(category.toLowerCase().replace(/\s+/g, "-"))}`,
            priority: "0.7",
            changefreq: "weekly",
          });
        }
      }
    } catch {
      // Non-fatal — sitemap still works with static pages only
    }
  }

  const allPages = [...STATIC_PAGES, ...categoryPages];
  const now = new Date().toISOString().split("T")[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (p) => `  <url>
    <loc>${DOMAIN}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
