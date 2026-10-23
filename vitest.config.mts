import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Two test projects: "main" (main-process code, scripts and shared utils, in Node) and
// "renderer" (React hooks and components, in a simulated DOM). See CLAUDE.md → Testing.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "main",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          setupFiles: ["tests/helpers/main-setup.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "renderer",
          environment: "jsdom",
          include: ["tests/renderer/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/helpers/renderer-setup.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/renderer/main.tsx"],
      reporter: ["text-summary", "html"],
      reportsDirectory: "coverage",
    },
  },
});
