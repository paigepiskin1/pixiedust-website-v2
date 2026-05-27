// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

// Static by default (fast on the edge). Pages opt into server rendering with
// `export const prerender = false`. platformProxy exposes D1/KV/R2 bindings in `astro dev`.
export default defineConfig({
  output: 'static',
  adapter: cloudflare({
    platformProxy: { enabled: true, remote: true },
  }),
  integrations: [react()],
  vite: {
    // Cast: @tailwindcss/vite ships types against a different Vite copy than
    // Astro's bundled Vite — harmless duplicate-type clash, runtime is fine.
    plugins: [/** @type {any} */ (tailwindcss())],
    // Force a single React instance so hooks work in client:only islands (motion
    // can otherwise pull a second copy in dev → "invalid hook call").
    resolve: { dedupe: ["react", "react-dom"] },
  },
});
