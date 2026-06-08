/// <reference types="vitest" />

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = {
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    globals: true,
    exclude: ["node_modules", "dist", "tests/e2e/**"]
  }
};

export default defineConfig(config);
