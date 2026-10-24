// Global setup for the "main" Vitest project: builds the test music library once, before any
// worker starts. Workers building it themselves would delete each other's half-written files.
import { ensureLibrary } from "../fixtures/generate.mjs";

export default function setup() {
  ensureLibrary();
}
