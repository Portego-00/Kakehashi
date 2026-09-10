import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["e2e/**", "node_modules/**", ".next/**", "src/features/notebooks/mobile-handwriting-interactions.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: { reporter: ["text", "json", "html"] },
  },
});
