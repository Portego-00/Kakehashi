import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// This bridge integration suite imports native DOM source outside web/. Give
// those components the same React/editor instances as their jsdom renderer.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom", "react-dom/client", "@blocknote/core", "@blocknote/core/locales", "@blocknote/core/extensions", "@blocknote/react", "@blocknote/mantine", "@blocknote/mantine/style.css", "lucide-react"].map((name) => ({ find: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), replacement: fileURLToPath(import.meta.resolve(name)) })),
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/features/notebooks/mobile-handwriting-interactions.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
