/// <reference types="vitest" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = {
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    globals: true,
    exclude: ["node_modules", "dist", ".worktrees/**", "tests/e2e/**"],
  },
};

export default defineConfig(config);
