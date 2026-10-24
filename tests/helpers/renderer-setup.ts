// Setup for the "renderer" Vitest project (simulated DOM), run before every test:
// - DOM matchers such as toBeInTheDocument, and cleanup of rendered components;
// - a fresh fake window.api (api.ts), working <audio> elements and Web Audio (audio.ts), and
//   fake layout so virtual lists render rows (layout.ts).
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

import { installApi } from "./api";
import { removeMediaSession, stubAudioContext, stubMedia } from "./audio";
import { installLayout } from "./layout";

beforeEach(() => {
  installApi();
  stubMedia();
  stubAudioContext();
  installLayout();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  removeMediaSession();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
