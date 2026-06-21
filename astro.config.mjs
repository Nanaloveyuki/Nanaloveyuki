// @ts-check
import { defineConfig } from 'astro/config';

const site = process.env.SITE_URL ?? 'https://naloveyuki.top';
const siteUrl = new URL(site);
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'Nanaloveyuki';
const owner = process.env.GITHUB_REPOSITORY_OWNER ?? 'Nanaloveyuki';
const isUserSite = repository.endsWith('.github.io');
const isDefaultGithubPagesHost = siteUrl.hostname === `${owner}.github.io`;
const base = !isDefaultGithubPagesHost || isUserSite ? '/' : `/${repository}/`;

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
