// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Static output is the default; the site is served from GitHub Pages.
  site: 'https://comzip.com',
  // No `base` is set: a custom domain via CNAME serves the site at the root path.
  integrations: [sitemap()],
  // Korean stays unprefixed at the existing root paths (preserves current SEO/
  // AdSense/Search Console setup); English pages live under `/en/...` and are
  // authored as real files at `src/pages/en/**` (not Astro's dynamic [locale]
  // routing), so this config only needs to describe that split.
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
