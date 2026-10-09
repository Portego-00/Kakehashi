import { defineConfig } from "vitest/config";
import mobile from "./vitest.mobile-dom.config";
export default defineConfig({ ...mobile, test: { ...mobile.test, include: ["src/features/bunpro/mobile-bunpro-details.test.tsx"] } });
