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
          // Real file scans and git processes; slow when the renderer tests run alongside.
          testTimeout: 20_000,
          include: ["tests/unit/**/*.test.ts"],
          globalSetup: ["tests/helpers/fixtures-setup.ts"],
          setupFiles: ["tests/helpers/main-setup.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "renderer",
          environment: "jsdom",
          // CSS Modules are applied (scroll areas, hidden elements…), scoped as in the app but with
          // stable names, so tests can use them: import the module and use styles.x.
          css: { include: [/\.module\.css$/], modules: { classNameStrategy: "stable" } },
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
