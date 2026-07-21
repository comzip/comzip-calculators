// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Static output is the default; the site is served from GitHub Pages.
  site: 'https://comzip.com',
  // No `base` is set: a custom domain via CNAME serves the site at the root path.
  integrations: [sitemap()],
});
