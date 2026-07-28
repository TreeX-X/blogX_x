import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import react from "@astrojs/react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  output: "server",
  adapter: vercel(),
  integrations: [react()],
  vite: {
    optimizeDeps: {
      include: ["react-dom/client", "react-dom", "react"],
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
});
