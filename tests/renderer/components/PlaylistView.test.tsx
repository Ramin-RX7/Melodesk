import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlaylistView } from "../../../src/renderer/components/PlaylistView";
import { ConfirmOptions, Playlist } from "../../../src/renderer/types";
import { fakeApi, installApi } from "../../helpers/api";
import { song } from "../../helpers/songs";

const one = song({ title: "One", artists: ["Zed"], duration: 300 });
const two = song({ title: "Two", artists: ["Amy"], duration: 100 });
const three = song({ title: "Three", artists: ["Max"], duration: 200 });
const library = [one, two, three];
const MISSING = "C:\\Music\\gone.mp3";

const playlist = (data: Partial<Playlist> = {}): Playlist => ({
  id: "mix",
  name: "Mix",
  songs: [one.path, two.path, three.path],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...data,
});

type Props = Partial<React.ComponentProps<typeof PlaylistView>>;

const renderView = (props: Props = {}) => {
  const handlers = {
    onPlayTrack: vi.fn(),
    onPlaylistSelect: vi.fn(),
    onPlaylistClose: vi.fn(),
    confirm: vi.fn<(o: ConfirmOptions) => Promise<number>>(async () => 0),
  };
  render(
    <PlaylistView
      allTracks={library}
      themeColor="#000"
      currentTrack={null}
      configDoubleClickToPlay
      selectedPlaylistId={null}
      {...handlers}
      {...props}
    />,
  );
  return { user: userEvent.setup(), ...handlers };
};

const openPlaylist = async (data: Partial<Playlist> = {}) => {
  installApi({ getPlaylists: async () => [playlist(data)] });
  const view = renderView({ selectedPlaylistId: "mix" });
  await screen.findByRole("heading", { name: "Mix" });
  return view;
};

const row = (title: string) => screen.getByText(title).closest("[draggable]") as HTMLElement;
const removeButton = (rowEl: HTMLElement) =>
  within(rowEl).getByRole("button", { name: "Remove from playlist" });
const savedSongs = () => fakeApi().updatePlaylist.mock.calls.at(-1)?.[1].songs;
const titles = () => screen.getAllByText(/^(One|Two|Three)$/).map((e) => e.textContent);

beforeEach(() => {
  installApi({ getPlaylists: async () => [playlist()] });
});

describe("the automatic playlists", () => {
  it("Recently Played lists each song once, newest first", async () => {
    installApi({
      getRecentPlays: async () => [
        { hash: three.hash!, timestamp: 3 },
        { hash: one.hash!, timestamp: 2 },
        { hash: three.hash!, timestamp: 1 },
      ],
    });
    renderView({ selectedPlaylistId: "__recently_played__" });
    await screen.findByText("Three");
    expect(titles()).toEqual(["Three", "One"]);
  });

  it("Most Played orders songs by play count, ignoring songs not in the library", async () => {
    installApi({
      getPlayCounts: async () => ({ [two.hash!]: 9, [one.hash!]: 3, [three.hash!]: 5, gone: 50 }),
    });
    renderView({ selectedPlaylistId: "__most_played__" });
    await screen.findByText("Two");
    expect(titles()).toEqual(["Two", "Three", "One"]);
  });
});

describe("creating and deleting playlists", () => {
  it("creates a playlist with a trimmed name; a blank name isn't created", async () => {
    const { user } = renderView();
    await user.click(await screen.findByRole("button", { name: /new playlist/i }));
    const name = screen.getByPlaceholderText("Playlist name");
    await user.type(name, "   {Enter}");
    expect(fakeApi().createPlaylist).not.toHaveBeenCalled();
    await user.type(name, " Road trip {Enter}");
    expect(fakeApi().createPlaylist).toHaveBeenCalledWith("Road trip");
  });

  it("asks before deleting a playlist; only Delete deletes it", async () => {
    const { user, confirm, onPlaylistSelect } = renderView();
    const deleteButton = await screen.findByRole("button", { name: 'Delete playlist "Mix"' });
    confirm.mockResolvedValueOnce(1);
    await user.click(deleteButton);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ buttons: ["Delete", "Cancel"], cancelId: 1, dangerId: 0 }),
    );
    expect(fakeApi().deletePlaylist).not.toHaveBeenCalled();

    await user.click(deleteButton);
    expect(fakeApi().deletePlaylist).toHaveBeenCalledWith("mix");
    expect(onPlaylistSelect).not.toHaveBeenCalled();
  });

  it("reloads when a playlist changes elsewhere", async () => {
    renderView();
    await screen.findByText("Mix");
    fakeApi().getPlaylists.mockResolvedValue([playlist({ name: "Renamed" })]);
    act(() => fakeApi().emit.playlistsChanged());
    expect(await screen.findByText("Renamed")).toBeInTheDocument();
  });
});

describe("removing and reordering songs", () => {
  it("removes the chosen copy of a song that's in the playlist twice, without playing it", async () => {
    const { user, onPlayTrack } = await openPlaylist({ songs: [one.path, two.path, one.path] });
    const copies = screen.getAllByText("One").map((el) => el.closest("[draggable]") as HTMLElement);
    await user.click(removeButton(copies[1]));
    expect(savedSongs()).toEqual([one.path, two.path]);
    expect(onPlayTrack).not.toHaveBeenCalled();
  });

  it("removes the chosen song when the playlist has a song no longer in the library", async () => {
    const { user } = await openPlaylist({ songs: [one.path, MISSING, two.path, three.path] });
    await user.click(removeButton(row("Three")));
    expect(savedSongs()).toEqual([one.path, MISSING, two.path]);
  });

  it("reorders songs by dragging", async () => {
    await openPlaylist();
    fireEvent.dragStart(row("Three"));
    fireEvent.dragEnter(row("One"));
    fireEvent.dragEnd(row("Three"));
    expect(savedSongs()).toEqual([three.path, one.path, two.path]);
  });

  it("finishes a drag on drop when the dragged row disappeared, and only once", async () => {
    await openPlaylist();
    fireEvent.dragStart(row("One"));
    fireEvent.dragEnter(row("Three"));
    fireEvent.drop(row("Three"));
    fireEvent.dragEnd(row("Three"));
    expect(fakeApi().updatePlaylist).toHaveBeenCalledTimes(1);
    expect(savedSongs()).toEqual([two.path, three.path, one.path]);
  });

  it("dropping a song on its own place changes nothing", async () => {
    await openPlaylist();
    fireEvent.dragStart(row("Two"));
    fireEvent.dragEnter(row("Two"));
    fireEvent.dragEnd(row("Two"));
    expect(fakeApi().updatePlaylist).not.toHaveBeenCalled();
  });

  it("reorders the right songs when the playlist has a song no longer in the library", async () => {
    await openPlaylist({ songs: [one.path, MISSING, two.path, three.path] });
    fireEvent.dragStart(row("Three"));
    fireEvent.dragEnter(row("Two"));
    fireEvent.dragEnd(row("Three"));
    expect(savedSongs()).toEqual([one.path, MISSING, three.path, two.path]);
  });

  it("can only be reordered in custom order and without a search", async () => {
    const { user } = await openPlaylist();
    expect(row("One")).toHaveAttribute("draggable", "true");
    await user.type(screen.getByPlaceholderText("Search in playlist..."), "o");
    expect(row("One")).toHaveAttribute("draggable", "false");
  });
});

describe("sorting and editing an open playlist", () => {
  it("sorts by title, artist or duration, saves the choice, and reverses it", async () => {
    const { user } = await openPlaylist();
    await user.selectOptions(screen.getByRole("combobox"), "duration");
    expect(titles()).toEqual(["Two", "Three", "One"]);
    expect(fakeApi().updatePlaylist).toHaveBeenLastCalledWith("mix", { sortBy: "duration" });

    await user.click(screen.getByRole("button", { name: "Reverse sort order" }));
    expect(titles()).toEqual(["One", "Three", "Two"]);
    expect(fakeApi().updatePlaylist).toHaveBeenLastCalledWith("mix", { sortDescending: true });

    await user.selectOptions(screen.getByRole("combobox"), "title");
    expect(titles()).toEqual(["Two", "Three", "One"]);
  });

  it("description: Enter saves, Escape cancels, an unchanged one isn't saved", async () => {
    const { user } = await openPlaylist({ description: "Old" });
    const box = () => screen.getByPlaceholderText("Add a description...");

    await user.click(screen.getByText("Old"));
    await user.keyboard("{Enter}");
    expect(fakeApi().updatePlaylist).not.toHaveBeenCalled();

    await user.click(screen.getByText("Old"));
    await user.clear(box());
    await user.type(box(), "Draft{Escape}");
    expect(fakeApi().updatePlaylist).not.toHaveBeenCalled();

    await user.click(screen.getByText("Old"));
    await user.clear(box());
    await user.type(box(), "New{Enter}");
    expect(fakeApi().updatePlaylist).toHaveBeenCalledWith("mix", { description: "New" });
  });

  it("Add Songs offers only songs not in the playlist yet, through the main process", async () => {
    const { user } = await openPlaylist({ songs: [one.path] });
    await user.click(screen.getByRole("button", { name: /add songs/i }));
    const dialog = screen.getByRole("heading", { name: "Add Songs" }).parentElement!.parentElement!;
    const addButton = (title: string) =>
      within(within(dialog).getByText(title).parentElement!.parentElement!).getByRole("button");
    expect(addButton("One")).toBeDisabled();

    fakeApi().addSongsToPlaylist.mockResolvedValue(playlist({ songs: [one.path, two.path] }));
    await user.click(addButton("Two"));
    expect(fakeApi().addSongsToPlaylist).toHaveBeenCalledWith("mix", [two.path]);
    await waitFor(() => expect(addButton("Two")).toBeDisabled());
  });
});
