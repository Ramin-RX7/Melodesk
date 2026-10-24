import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GlobalSearch } from "../../../src/renderer/components/GlobalSearch/GlobalSearch";
import { FileItem, UserConfig } from "../../../src/renderer/types";
import { makeConfig, song } from "../../helpers/songs";

const alan = ["Alan Walker"];
const library: FileItem[] = [
  song({ title: "Faded", artists: alan, album: "Different World" }),
  song({ title: "Alone", artists: alan, album: "Different World" }),
  song({ title: "Lily", artists: [...alan, "K-391"], album: "Different World" }),
  song({ title: "Darkside", artists: alan, album: "Single" }),
  song({ title: "Sing Me to Sleep", artists: alan, album: "Single" }),
  song({ title: "Spectre", artists: alan }),
  song({ title: "Yellow", artists: ["Coldplay"], album: "Parachutes" }),
];

const renderSearch = (config: Partial<UserConfig> = {}) => {
  const handlers = { onPlaySong: vi.fn(), onNavigate: vi.fn() };
  const user = userEvent.setup();
  render(
    <GlobalSearch
      allTracks={library}
      config={makeConfig(config)}
      themeColor="#000"
      {...handlers}
    />,
  );
  const input = screen.getByPlaceholderText("Search library...");
  return { user, input, ...handlers };
};

/** The results under a heading ("Songs", "Albums", "Artists"). */
const section = (title: string) => within(screen.getByText(title).parentElement!.parentElement!);
const songTitles = () =>
  library.map((s) => s.metadata!.title!).filter((title) => screen.queryByText(title));

describe("GlobalSearch", () => {
  it("ignores spaces around the text, so results don't vanish while typing", async () => {
    const { user, input } = renderSearch();
    await user.type(input, "alan ");
    expect(section("Artists").getByText("Alan Walker")).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "   ");
    expect(screen.queryByText("Songs")).toBeNull();
  });

  it("shows as many results per category as the setting says, or all of them", async () => {
    const { user, input } = renderSearch({ searchResultsPerCategory: 2 });
    await user.type(input, "alan");
    expect(songTitles()).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Show all 6" }));
    expect(songTitles()).toHaveLength(6);
  });

  it("a double-click plays the song with the matching songs as the queue", async () => {
    const { user, input, onPlaySong } = renderSearch();
    await user.type(input, "faded");
    await user.click(screen.getByText("Faded"));
    expect(onPlaySong).not.toHaveBeenCalled();
    await user.dblClick(screen.getByText("Faded"));
    expect(onPlaySong).toHaveBeenCalledWith(library[0], [library[0]]);
    expect(input).toHaveValue("");
  });

  it("a single click plays when double-click to play is off", async () => {
    const { user, input, onPlaySong } = renderSearch({ doubleClickToPlay: false });
    await user.type(input, "yellow");
    await user.click(screen.getByText("Yellow"));
    expect(onPlaySong).toHaveBeenCalledWith(library[6], [library[6]]);
  });

  it("opens an artist page, and the full album list with the trimmed text", async () => {
    const { user, input, onNavigate } = renderSearch({
      searchResultsPerCategory: 1,
      minSongsForAlbum: 2,
    });
    await user.type(input, "  alan ");
    await user.click(section("Artists").getByText("Alan Walker"));
    expect(onNavigate).toHaveBeenLastCalledWith({ tab: "artists", groupName: "Alan Walker" });

    await user.type(input, " i ");
    await user.click(section("Albums").getByRole("button", { name: "Show more" }));
    expect(onNavigate).toHaveBeenLastCalledWith({ tab: "albums", query: "i" });
  });
});
