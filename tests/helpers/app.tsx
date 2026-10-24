// Renders the whole app (src/renderer/App.tsx) against the fake window.api, with a given
// library, settings and saved session, and waits until startup has finished.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect } from "vitest";

import App from "../../src/renderer/App";
import { FileItem, SessionData, UserConfig } from "../../src/renderer/types";
import { FakeApi, installApi } from "./api";
import { makeConfig } from "./songs";

type Options = {
  library?: FileItem[];
  config?: Partial<UserConfig>;
  session?: Partial<SessionData> | null;
  api?: Partial<Window["api"]>;
};

export const renderApp = async ({
  library = [],
  config = {},
  session = null,
  api = {},
}: Options = {}) => {
  let current = makeConfig(config);
  const fake: FakeApi = installApi({
    getConfig: async () => current,
    updateConfig: async (partial) => (current = { ...current, ...partial }),
    getLibraryFiles: async () => library,
    getSession: async () =>
      session && {
        currentTrackPath: null,
        queue: [],
        shuffledQueue: [],
        currentIndex: 0,
        isShuffle: false,
        repeatMode: "none",
        ...session,
      },
    ...api,
  });
  const user = userEvent.setup();
  const view = render(<App />);
  await waitFor(() => expect(fake.getLibraryFiles).toHaveBeenCalled());
  // Startup is done once the first page is shown.
  await screen.findByRole("heading", { name: library.length > 0 ? "Home" : "Library Folders" });
  const audio = document.querySelector("audio")!;
  return { user, api: fake, audio, ...view };
};

/** Queries inside the playback bar (the bar holds the seek slider). */
export const playbackBar = () =>
  within(screen.getByRole("slider", { name: "Seek" }).parentElement!.parentElement!);
