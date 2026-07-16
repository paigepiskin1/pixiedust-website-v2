// Same-origin Firebase auth: serves the reserved /__/* paths (auth handler,
// iframe, init.json) by proxying to the project's Firebase Hosting. Injected
// at /__/[...rest] via astro.config.mjs (src/pages ignores _-prefixed dirs).
// The middleware intercepts these requests before this handler runs (so the
// global security headers never apply — X-Frame-Options would break the auth
// iframe); this route exists so Astro treats /__/* as an on-demand route
// instead of short-circuiting to the static 404.
export const prerender = false;
import type { APIContext } from "astro";

const UPSTREAM = "https://pixie-dust-apps.firebaseapp.com";

function proxy({ request }: APIContext) {
  const u = new URL(request.url);
  return fetch(new Request(UPSTREAM + u.pathname + u.search, request));
}

export const GET = proxy;
export const POST = proxy;
export const OPTIONS = proxy;
