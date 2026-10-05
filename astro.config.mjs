// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// Firebase reserved auth paths (/__/auth/*, /__/firebase/*) must be real
// on-demand routes so the middleware proxy intercepts them (unmatched paths
// short-circuit to the static 404 without running middleware). src/pages
// ignores _-prefixed dirs, so the route is injected here instead.
/** @type {import('astro').AstroIntegration} */
const firebaseAuthProxy = {
  name: 'firebase-auth-proxy',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      injectRoute({ pattern: '/__/[...rest]', entrypoint: './src/server/firebase-proxy.ts', prerender: false });
    },
  },
};

// Static by default (fast on the edge). Pages opt into server rendering with
// `export const prerender = false`. platformProxy exposes D1/KV/R2 bindings in `astro dev`.
export default defineConfig({
  output: 'static',
  // NOTE: deliberately NOT `trailingSlash: 'never'`. Astro implements that with
  // its own 308 issued *before* middleware runs, which on the old domain meant
  // a same-host slash-strip followed by the migration 301 — two hops for every
  // indexed legacy URL. Middleware does it instead, in a single 301 that strips
  // the slash and changes host at the same time. See src/middleware.ts.
  adapter: cloudflare({
    platformProxy: /** @type {any} */ ({ enabled: true, remote: true }),
    // Every page is server-rendered (`prerender = false`), so Astro emits a
    // single `include: ["/*"]` here and the worker sees all non-asset requests.
    // That matters for two things:
    //  • /__/*  — Firebase's reserved auth paths, proxied same-origin so mobile
    //    OAuth redirects complete (see middleware).
    //  • unmatched legacy URLs (/index.php, deleted pages) — they reach the
    //    server-rendered 404 route, so middleware runs and the old-domain 301
    //    to pixydust.com fires instead of Pages serving a static 404.
    // If a page is ever switched back to prerendered, Astro enumerates explicit
    // paths instead of "/*" and both of those silently break. Cloudflare rejects
    // overlapping rules, so they can't just be listed alongside "/*" — the page
    // has to stay on-demand, or the catch-all has to be reinstated another way.
  }),
  integrations: [react(), firebaseAuthProxy],
  vite: {
    // Cast: @tailwindcss/vite ships types against a different Vite copy than
    // Astro's bundled Vite — harmless duplicate-type clash, runtime is fine.
    plugins: [/** @type {any} */ (tailwindcss())],
    // Force a single React instance so hooks work in client:only islands (motion
    // can otherwise pull a second copy in dev → "invalid hook call").
    resolve: { dedupe: ["react", "react-dom"] },
  },
});
