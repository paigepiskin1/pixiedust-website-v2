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
  adapter: cloudflare({
    platformProxy: /** @type {any} */ ({ enabled: true, remote: true }),
    // Route Firebase's reserved /__/* auth paths to the worker so the
    // middleware can proxy them same-origin (mobile OAuth redirect fix).
    routes: { extend: { include: [{ pattern: '/__/*' }] } },
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
