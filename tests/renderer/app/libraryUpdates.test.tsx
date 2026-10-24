import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FileItem } from "../../../src/renderer/types";
import { playbackBar, renderApp } from "../../helpers/app";
import { fire, setMedia } from "../../helpers/audio";
import { mediaUrl, song } from "../../helpers/songs";

const alpha = song({ path: "C:\\Music\\alpha.mp3", title: "Alpha", artists: ["Ann"] });
const beta = song({ title: "Beta", artists: ["Ann"] });
const gamma = song({ title: "Gamma", artists: ["Cy"] });
const library = [alpha, beta, gamma];

const queueTitles = () =>
  [...document.querySelectorAll<HTMLElement>("[data-active]")].map(
    (row) => row.children[2].firstElementChild!.textContent,
  );

const playAlpha = async (user: Awaited<ReturnType<typeof renderApp>>["user"]) => {
  await user.dblClick(screen.getAllByText("Alpha")[0]);
  await waitFor(() => expect(playbackBar().getByText("Alpha")).toBeInTheDocument());
};

describe("when the library changes", () => {
  it("the playing song shows its new tags", async () => {
    const { user, api } = await renderApp({ library });
    await playAlpha(user);
    const retagged: FileItem = {
      ...alpha,
      metadata: { ...alpha.metadata, title: "Alpha (Remastered)" },
    };
    act(() => api.emit.libraryUpdated([retagged, beta, gamma]));
    expect(playbackBar().getByText("Alpha (Remastered)")).toBeInTheDocument();
  });

  it("a moved playing song is loaded from its new place and carries on where it was", async () => {
    const { user, api, audio } = await renderApp({ library });
    await playAlpha(user);
    setMedia(audio, { duration: 200, currentTime: 42, paused: false });

    const moved: FileItem = { ...alpha, path: "D:\\Elsewhere\\alpha.mp3", name: "alpha.mp3" };
    act(() => api.emit.libraryUpdated([moved, beta, gamma]));
    expect(audio.getAttribute("src")).toBe(mediaUrl(moved.path));
    expect(audio.dataset.relocating).toBe("true");
    act(() => fire(audio, "loadedmetadata"));
    expect(audio.currentTime).toBe(42);
    expect(playbackBar().getByText("Alpha")).toBeInTheDocument();
  });

  it("songs that left the library stay in the queue", async () => {
    const { user, api } = await renderApp({ library });
    await user.click(screen.getByRole("button", { name: /shuffle play/i }));
    act(() => api.emit.libraryUpdated([alpha, gamma]));
    await user.click(within(screen.getByRole("navigation")).getByText("Queue"));
    expect(queueTitles().sort()).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("edited tags show up in the queue at once", async () => {
    const { user, api } = await renderApp({ library });
    await playAlpha(user);
    api.getMetadata.mockResolvedValue({
      ...alpha,
      metadata: { ...alpha.metadata, title: "Renamed" },
    });

    await user.click(playbackBar().getByText("Alpha"));
    await user.click(await screen.findByRole("button", { name: /edit tags/i }));
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Renamed");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByRole("heading", { name: "Renamed" })).toBeInTheDocument();
    expect(playbackBar().getByText("Renamed")).toBeInTheDocument();
  });
});

describe("questions, drops and skipping", () => {
  it("a question from the main process is shown in the app's dialog and answered", async () => {
    const { user, api } = await renderApp({ library });
    act(() =>
      api.emit.confirmRequest({
        id: 7,
        title: "Replace library folders",
        message: "Replace 2 folders?",
        buttons: ["Replace", "Cancel"],
        defaultId: 0,
        cancelId: 1,
      }),
    );
    expect(
      screen.getByRole("alertdialog", { name: "Replace library folders" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Replace" }));
    expect(api.respondToConfirm).toHaveBeenCalledWith(7, 0);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("a file dropped onto the window plays", async () => {
    const { api } = await renderApp({ library });
    const file = new File(["x"], "dropped.mp3");
    fireEvent.drop(screen.getByRole("heading", { name: "Home" }), {
      dataTransfer: { files: [file] },
    });
    await waitFor(() => expect(playbackBar().getByText("dropped.mp3")).toBeInTheDocument());
    expect(api.getMetadata).toHaveBeenCalledWith("C:\\Dropped\\dropped.mp3");
  });

  it("a song that can't be played is skipped with a message", async () => {
    const { user, api, audio } = await renderApp({ library });
    await user.click(screen.getByRole("button", { name: /shuffle play/i }));
    const first = playbackBar().getByText(/^(Alpha|Beta|Gamma)$/).textContent;
    api.fileExists.mockResolvedValue(false);
    act(() => fire(audio, "error"));
    expect(await screen.findByRole("alert")).toHaveTextContent(`Skipped "${first}"`);
    await waitFor(() => expect(playbackBar().queryByText(first!)).toBeNull());
    expect(api.refreshLibrary).toHaveBeenCalled();
  });
});
