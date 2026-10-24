import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { playbackBar, renderApp } from "../../helpers/app";
import { fire, setMedia } from "../../helpers/audio";
import { mediaUrl, song } from "../../helpers/songs";

const a = song({ title: "Alpha" });
const b = song({ title: "Beta" });
const c = song({ title: "Gamma" });
const library = [a, b, c];
const GONE = "C:\\Music\\gone.mp3";

describe("starting the app", () => {
  it("opens the Library page when the library is empty, Home otherwise", async () => {
    const { unmount } = await renderApp();
    expect(screen.getByRole("heading", { name: "Library Folders" })).toBeInTheDocument();
    unmount();
    await renderApp({ library });
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
  });
});

describe("restoring the last session", () => {
  it("restores the queue and the song, and continues where it was", async () => {
    const { audio } = await renderApp({
      library,
      session: {
        queue: [a.path, b.path, c.path],
        currentTrackPath: b.path,
        currentIndex: 1,
        position: 42,
      },
    });
    expect(playbackBar().getByText("Beta")).toBeInTheDocument();
    expect(audio.getAttribute("src")).toBe(mediaUrl(b.path));
    setMedia(audio, { duration: 180 });
    act(() => fire(audio, "loadedmetadata"));
    expect(audio.currentTime).toBe(42);
  });

  it("doesn't seek past the end of a song that got shorter", async () => {
    const { audio } = await renderApp({
      library,
      session: { queue: [a.path], currentTrackPath: a.path, position: 500 },
    });
    setMedia(audio, { duration: 200 });
    act(() => fire(audio, "loadedmetadata"));
    expect(audio.currentTime).toBe(0);
  });

  it("leaves out songs that are no longer in the library, and says so", async () => {
    await renderApp({
      library,
      session: { queue: [a.path, GONE, c.path], currentTrackPath: c.path, currentIndex: 2 },
    });
    expect(await screen.findByText(/1 song from your last session/)).toBeInTheDocument();
    expect(playbackBar().getByText("Gamma")).toBeInTheDocument();
  });

  it("restores shuffle and repeat", async () => {
    await renderApp({
      library,
      session: {
        queue: [a.path, b.path, c.path],
        shuffledQueue: [c.path, a.path, b.path],
        isShuffle: true,
        repeatMode: "one",
        currentIndex: 0,
        currentTrackPath: c.path,
      },
    });
    expect(playbackBar().getByText("Gamma")).toBeInTheDocument();
    expect(screen.getByTitle("Repeat: one")).toBeInTheDocument();
  });

  it("forgets the session when restoring it is turned off", async () => {
    const { api } = await renderApp({
      library,
      config: { restoreSession: false },
      session: { queue: [a.path] },
    });
    await waitFor(() => expect(api.clearSession).toHaveBeenCalled());
    expect(api.getSession).not.toHaveBeenCalled();
  });

  it("saves the session when a song is played, starting at the beginning", async () => {
    const { api, user } = await renderApp({ library });
    await user.click(screen.getByRole("button", { name: /shuffle play/i }));
    await waitFor(() => expect(api.saveSession).toHaveBeenCalled());
    expect(api.saveSession.mock.calls.at(-1)![0]).toMatchObject({
      queue: library.map((s) => s.path),
      isShuffle: true,
      position: 0,
    });
  });
});
