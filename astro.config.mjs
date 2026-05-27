// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// Static by default (fast on the edge). Pages opt into server rendering with
// `export const prerender = false`. platformProxy exposes D1/KV/R2 bindings in `astro dev`.
export default defineConfig({
  output: 'static',
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  vite: {
    // Cast: @tailwindcss/vite ships types against a different Vite copy than
    // Astro's bundled Vite — harmless duplicate-type clash, runtime is fine.
    plugins: [/** @type {any} */ (tailwindcss())],
  },
});
