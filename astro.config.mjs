// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

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
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('/three/examples/jsm/postprocessing/') ||
              id.includes('/three/examples/jsm/shaders/')
            ) {
              return 'three-postprocessing';
            }

            if (id.includes('/node_modules/three/')) {
              return 'three-core';
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
        '@blackhole': fileURLToPath(new URL('./src/features/blackhole', import.meta.url)),
      },
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
