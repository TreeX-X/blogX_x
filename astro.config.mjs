// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://TreeX-X.github.io',

  vite: {
    plugins: [tailwindcss()],
  },

  adapter: vercel(),
});