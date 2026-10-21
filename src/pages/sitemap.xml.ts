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

interface Entry {
  loc: string;
  priority: string;
  changefreq: string;
  lastmod?: string;
}

const PAGES: Entry[] = [
  { loc: "/", priority: "1.0", changefreq: "daily" },
  { loc: "/trending", priority: "0.9", changefreq: "daily" },
  { loc: "/presets", priority: "0.8", changefreq: "weekly" },
  { loc: "/hair", priority: "0.8", changefreq: "weekly" },
  { loc: "/beauty", priority: "0.8", changefreq: "weekly" },
  { loc: "/avatar", priority: "0.8", changefreq: "weekly" },
  { loc: "/video", priority: "0.8", changefreq: "weekly" },
  { loc: "/shoots", priority: "0.7", changefreq: "weekly" },
  { loc: "/credits", priority: "0.6", changefreq: "monthly" },
  { loc: "/support", priority: "0.6", changefreq: "monthly" },
  { loc: "/about", priority: "0.5", changefreq: "monthly" },
  { loc: "/brand", priority: "0.4", changefreq: "monthly" },
  { loc: "/legal/terms", priority: "0.3", changefreq: "monthly" },
  { loc: "/legal/privacy", priority: "0.3", changefreq: "monthly" },
  { loc: "/legal/acceptable-use", priority: "0.3", changefreq: "monthly" },
];

export async function GET({ locals }: APIContext) {
  const now = new Date().toISOString().split("T")[0];

  // Items: every live item at its section URL, with its own lastmod so a
  // re-crawl is prompted by an actual edit rather than by today's date sitting
  // on every URL. listPublished excludes drafts and anything scheduled for
  // later, so an unfinished item is never advertised. One pass over all items
  // — Blog is a section like the others — so nothing can be listed twice.
  let posts: Entry[] = [];
  try {
    const db = (locals as any)?.runtime?.env?.DB;
    if (db) {
      const { listPublished, isoDate } = await import("../lib/blog");
      const { sectionsById, itemHref } = await import("../lib/sections");
      const [items, sections] = await Promise.all([listPublished(db, 2000), sectionsById(db)]);
      posts = items
        // An item filed under an unpublished section has no reachable page.
        .filter((p) => sections.has(p.section || "blog"))
        .map((p) => ({
          loc: itemHref(sections, p),
          priority: "0.7",
          changefreq: "monthly",
          lastmod: (isoDate(p.updated_at) || "").split("T")[0] || now,
        }));
    }
  } catch {
    // A sitemap missing the items beats a sitemap that 500s.
  }

  // Help Centre, now database-backed and editable in the admin. listCategories
  // and allArticles return published rows only, so an unfinished article is
  // never advertised — the same rule the blog above follows.
  let help: Entry[] = [];
  try {
    const db = (locals as any)?.runtime?.env?.DB;
    if (db) {
      const { listCategories, allArticles, categoryHref, articleHref } = await import("../lib/help-db");
      const [cats, arts] = await Promise.all([listCategories(db), allArticles(db)]);
      help = [
        ...cats.map((c) => ({ loc: categoryHref(c.id), priority: "0.5", changefreq: "monthly" })),
        ...arts.map((a) => ({ loc: articleHref(a.categoryId, a.slug), priority: "0.5", changefreq: "monthly" })),
      ];
    }
  } catch {
    // Same rule as the blog: a sitemap missing the help centre beats a 500.
  }

  // Section index pages (/blog, /made-with-pixydust …). Their items are
  // listed above.
  let sections: Entry[] = [];
  try {
    const db = (locals as any)?.runtime?.env?.DB;
    if (db) {
      const { listSections } = await import("../lib/sections");
      sections = (await listSections(db)).map((sec) => ({
        loc: `/${sec.slug}`,
        priority: sec.id === "blog" ? "0.9" : "0.7",
        changefreq: "weekly",
      }));
    }
  } catch {
    // Same rule as above: a smaller sitemap beats a 500.
  }

  const all: Entry[] = [...PAGES, ...posts, ...help, ...sections];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all
  .map(
    (p) => `  <url>
    <loc>${DOMAIN}${p.loc}</loc>
    <lastmod>${p.lastmod || now}</lastmod>
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
