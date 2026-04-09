// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://TreeX-X.github.io',

  base: '/blogX_x',

  vite: {
    plugins: [tailwindcss()],
  },
});
