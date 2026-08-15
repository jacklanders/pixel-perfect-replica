import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Config de test aislada del vite.config.ts gestionado por Lovable
// (@lovable.dev/vite-tanstack-config no debe tocarse a mano; vitest no lo necesita).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    css: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
