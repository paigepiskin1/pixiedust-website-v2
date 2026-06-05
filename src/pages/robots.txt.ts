// Host-aware robots.txt: the production apex is indexable; every other host
// (sys.* staging, *.pages.dev, localhost) is fully disallowed so staging never
// competes with pixiedustapp.com in search.
export const prerender = false;
import type { APIContext } from "astro";

const PROD_HOSTS = new Set(["pixiedustapp.com", "www.pixiedustapp.com"]);

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

Sitemap: https://pixiedustapp.com/sitemap.xml
`
    : `User-agent: *
Disallow: /
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
