import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Domain functions are pure — no DOM, no framework. A component-test setup
// (jsdom / testing-library) is deliberately not wired here.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,mts,tsx}"],
  },
});
