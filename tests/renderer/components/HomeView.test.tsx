import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import cardCss from "../../../src/renderer/components/GroupedView/GroupedView.module.css";
import { HomeView } from "../../../src/renderer/components/HomeView/HomeView";
import css from "../../../src/renderer/components/HomeView/HomeView.module.css";
import { UserConfig } from "../../../src/renderer/types";
import { installApi } from "../../helpers/api";
import { makeConfig, song } from "../../helpers/songs";

const a = song({ title: "A", artists: ["Ann"], album: "One", genre: ["Pop"], duration: 120 });
const b = song({
  title: "B",
  artists: ["Ann", "Bob"],
  album: "One",
  genre: ["pop "],
  duration: 60,
});
const c = song({ title: "C", artists: ["Cy"], album: "Two", genre: ["Rock"], duration: 30 });
const d = song({ title: "D", artists: ["Cy"], duration: 30 });
const library = [a, b, c, d];

const renderHome = async ({
  counts = {} as Record<string, number>,
  recent = [] as string[],
  config = {} as Partial<UserConfig>,
} = {}) => {
  installApi({
    getPlayCounts: async () => counts,
    getRecentPlays: async () => recent.map((hash, i) => ({ hash, timestamp: 1000 - i })),
  });
  render(
    <HomeView
      allTracks={library}
      currentTrack={null}
      themeColor="#000"
      config={makeConfig(config)}
      handleFileSelect={vi.fn()}
      handleShufflePlay={vi.fn()}
      onContextMenu={vi.fn()}
      onScrollRef={() => {}}
      onSelectArtist={vi.fn()}
      onNavigateTab={vi.fn()}
      detail={null}
      onOpenDetail={vi.fn()}
      onCloseDetail={vi.fn()}
    />,
  );
  await screen.findByRole("heading", { name: "Statistics" });
};

const section = (title: string) => screen.getByRole("heading", { name: title }).closest("section")!;
const titlesIn = (title: string) =>
  [...section(title).querySelectorAll(`.${cardCss.songTitle}`)].map((el) => el.textContent);
const stat = (label: string) =>
  screen.getByText(label, { selector: `.${css.statLabel}` }).closest(`.${css.statCard}`);

describe("HomeView", () => {
  it("lists recently played songs without repeats, newest first", async () => {
    await renderHome({ recent: [c.hash!, a.hash!, c.hash!, "gone"] });
    await waitFor(() => expect(titlesIn("Recently Played")).toEqual(["C", "A"]));
  });

  it("lists the most played songs, and the songs never played", async () => {
    await renderHome({ counts: { [b.hash!]: 5, [a.hash!]: 2 } });
    await waitFor(() => expect(titlesIn("Most Played")).toEqual(["B", "A"]));
    expect(titlesIn("Never Played")).toEqual(["C", "D"]);
  });

  it("ranks artists by plays, then by number of songs", async () => {
    await renderHome({ counts: { [c.hash!]: 1 } });
    await waitFor(() =>
      expect(
        within(section("Most Popular Artists"))
          .getAllByText(/^(Ann|Bob|Cy)$/)
          .map((e) => e.textContent),
      ).toEqual(["Cy", "Ann", "Bob"]),
    );
  });

  it("adds up the library statistics", async () => {
    await renderHome({ counts: { [a.hash!]: 3, [c.hash!]: 2 } });
    await waitFor(() => expect(stat("Total Plays")).toHaveTextContent("5"));
    expect(stat("Songs")).toHaveTextContent("4");
    expect(stat("Artists")).toHaveTextContent("3");
    expect(stat("Albums")).toHaveTextContent("2");
    // "Pop" and "pop " are one genre.
    expect(stat("Genres")).toHaveTextContent("2");
    // 3 × 2 min + 2 × 30 s
    expect(stat("Listening Time")).toHaveTextContent("7m");
    expect(stat("Never Played")).toHaveTextContent("2");
    expect(stat("Top Song")).toHaveTextContent("A3 plays");
    expect(stat("Top Artist")).toHaveTextContent("Ann3 plays");
  });

  it("shows only as many songs per row as the Home limit, with Show all past it", async () => {
    await renderHome({ config: { homeItemLimit: 2 } });
    expect(titlesIn("Never Played")).toEqual(["A", "B"]);
    expect(within(section("Never Played")).getByRole("button", { name: "Show all" })).toBeTruthy();
    expect(
      within(section("Recently Played")).queryByRole("button", { name: "Show all" }),
    ).toBeNull();
  });
});
