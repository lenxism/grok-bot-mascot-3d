import { defineConfig } from "vite";

export default defineConfig({
  base: "/grok-bot-mascot-3d/",
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
