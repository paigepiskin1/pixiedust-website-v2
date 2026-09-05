// Host-aware robots.txt: the production apex is indexable; every other host
// (sys.* staging, *.pages.dev, localhost) is fully disallowed so staging never
// competes with pixydust.com in search.
export const prerender = false;
import type { APIContext } from "astro";

// New primary domain is pixydust.com. The old pixiedustapp.com hosts are kept
// indexable during the transition (they may still serve/redirect).
const PROD_HOSTS = new Set(["pixydust.com", "www.pixydust.com", "pixiedustapp.com", "www.pixiedustapp.com"]);

export function GET({ url }: APIContext) {
  const isProd = PROD_HOSTS.has(url.hostname);
  const body = isProd
    ? `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /studio/
Disallow: /account/
Disallow: /auth/

Sitemap: https://pixydust.com/sitemap.xml
`
    : `User-agent: *
Disallow: /
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
