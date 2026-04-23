import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  output: "server",
  adapter: vercel(),
  integrations: [react()],
  alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
