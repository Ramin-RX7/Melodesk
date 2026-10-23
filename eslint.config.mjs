import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// Lint rules for the whole repo (`npm run lint`, part of `npm run check`). Besides the standard
// TypeScript checks, it enforces the hook rules and a few project rules from CLAUDE.md.
export default tseslint.config(
  {
    ignores: [
      "dist/",
      "release/",
      "coverage/",
      "playwright-report/",
      "test-results/",
      "tests/fixtures/generated/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Unused arguments are fine when prefixed with "_" (event handlers, IPC handlers).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}", "src/hooks/**/*.ts", "tests/renderer/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      // Questions go through the app's own dialog (CLAUDE.md §6 → Questions to the user).
      "no-restricted-globals": [
        "error",
        { name: "alert", message: "Use a toast (showToast / notify)." },
        { name: "confirm", message: "Use the confirm prop (themed ConfirmDialog)." },
        { name: "prompt", message: "Build the input into the UI." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "alert", message: "Use a toast (showToast / notify)." },
        { object: "window", property: "confirm", message: "Use the confirm prop." },
        { object: "window", property: "prompt", message: "Build the input into the UI." },
      ],
    },
  },
  {
    files: ["src/main/**/*.ts", "src/main.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "dialog", property: "showMessageBox", message: "Use askUser (confirmService)." },
        {
          object: "dialog",
          property: "showMessageBoxSync",
          message: "Use askUser (confirmService).",
        },
        { object: "dialog", property: "showErrorBox", message: "Use notify (notifyService)." },
        {
          object: "fs",
          property: "writeFileSync",
          message: "Write data files with writeJson (jsonStore.ts): atomic, with backups.",
        },
      ],
    },
  },
  {
    // Files that legitimately write files directly: the JSON store itself and the art cache.
    files: [
      "src/main/services/jsonStore.ts",
      "src/main/services/artCacheService.ts",
      "src/main/services/metadataService.ts",
      "src/main/ipc/artistHandlers.ts",
    ],
    rules: { "no-restricted-properties": "off" },
  },
);
