import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SongDetailsView } from "../../../src/renderer/components/SongDetailsView";
import { FileItem } from "../../../src/renderer/types";
import { fakeApi, installApi } from "../../helpers/api";
import { song } from "../../helpers/songs";

const mp3 = song({
  path: "C:\\Music\\hello.mp3",
  title: "Hello",
  artist: "Adele",
  artists: ["Adele", "Guest"],
  album: "25",
  genre: ["Pop", "Soul"],
  year: 2015,
});
const flac = song({ path: "C:\\Music\\track.flac", title: "Lossless" });

const renderDetails = (track: FileItem = mp3) => {
  const handlers = { onTrackUpdated: vi.fn(), notify: vi.fn() };
  render(
    <SongDetailsView
      currentTrack={track}
      themeColor="#000"
      onBack={vi.fn()}
      onNavigate={vi.fn()}
      {...handlers}
    />,
  );
  return { user: userEvent.setup(), ...handlers };
};

const startEditing = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: /edit tags/i }));
const editing = () => screen.queryByRole("heading", { name: "Edit Metadata" });

describe("editing tags", () => {
  it("only MP3 files can be edited; others get a message instead", async () => {
    const { user, notify } = renderDetails(flac);
    await startEditing(user);
    expect(notify).toHaveBeenCalledWith({
      level: "info",
      message: "Editing tags is only supported for MP3 files for now.",
    });
    expect(editing()).toBeNull();
  });

  it("saves the edited tags, re-reads the song and leaves edit mode", async () => {
    const updated = { ...mp3, metadata: { ...mp3.metadata, title: "Hello (Remix)" } };
    installApi({ getMetadata: async () => updated });
    const { user, onTrackUpdated, notify } = renderDetails();
    await startEditing(user);
    await user.type(screen.getByLabelText("Title"), " (Remix)");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(fakeApi().writeMetadata).toHaveBeenCalledWith(mp3.path, {
      title: "Hello (Remix)",
      artist: "Adele, Guest",
      album: "25",
      genre: "Pop, Soul",
      year: "2015",
    });
    await waitFor(() => expect(onTrackUpdated).toHaveBeenCalledWith(updated));
    expect(editing()).toBeNull();
    expect(notify).not.toHaveBeenCalled();
  });

  it("tells the user when the file couldn't be written, and stays in edit mode", async () => {
    installApi({ writeMetadata: async () => false });
    const { user, notify, onTrackUpdated } = renderDetails();
    await startEditing(user);
    await user.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ level: "error" })),
    );
    expect(onTrackUpdated).not.toHaveBeenCalled();
    expect(editing()).not.toBeNull();
  });

  it("tells the user when saving failed unexpectedly", async () => {
    installApi({ writeMetadata: async () => Promise.reject(new Error("boom")) });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { user, notify } = renderDetails();
    await startEditing(user);
    await user.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ level: "error" })),
    );
  });
});

describe("Find Lyrics", () => {
  const searchedFor = () =>
    decodeURIComponent(fakeApi().openExternalUrl.mock.calls[0][0].split("?q=")[1]);

  it("searches the web with the song's artists and title", async () => {
    const { user } = renderDetails();
    await user.click(screen.getByRole("button", { name: /show lyrics/i }));
    await user.click(screen.getByRole("button", { name: /find lyrics/i }));
    expect(searchedFor()).toBe("Adele Guest Hello lyrics");
  });

  it("uses the file name, and no 'undefined', for a song without tags", async () => {
    const untagged = song({
      path: "C:\\Music\\demo take.mp3",
      title: undefined,
      artists: undefined,
    });
    const { user } = renderDetails(untagged);
    await user.click(screen.getByRole("button", { name: /show lyrics/i }));
    await user.click(screen.getByRole("button", { name: /find lyrics/i }));
    expect(searchedFor()).toBe("demo take lyrics");
  });
});
