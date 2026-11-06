import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // Shared mobile DOM components and their icons use the web renderer's React.
    dedupe: ["react", "react-dom", "lucide-react"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["e2e/**", "node_modules/**", ".next/**", "src/features/notebooks/mobile-handwriting-interactions.test.tsx", "src/features/study/components/mobile-multiple-choice-keyboard.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: { reporter: ["text", "json", "html"] },
  },
});
