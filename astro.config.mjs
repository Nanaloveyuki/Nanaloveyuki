// @ts-check
import { defineConfig } from 'astro/config';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'Nanaloveyuki';
const owner = process.env.GITHUB_REPOSITORY_OWNER ?? 'Nanaloveyuki';
const isUserSite = repository.endsWith('.github.io');
const base = process.env.GITHUB_ACTIONS && !isUserSite ? `/${repository}` : '/';
const site =
  process.env.SITE_URL ?? `https://${owner}.github.io${isUserSite ? '' : `/${repository}`}`;

// https://astro.build/config
export default defineConfig({
  site,
  base,
  output: 'static',
  compressHTML: true,
  scopedStyleStrategy: 'where',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
