import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GroupedView } from "../../../src/renderer/components/GroupedView/GroupedView";
import { ArtistInfo, FileItem, UserConfig } from "../../../src/renderer/types";
import { normalizeGenre } from "../../../src/utils/metadata";
import { fakeApi, installApi } from "../../helpers/api";
import { makeConfig, song } from "../../helpers/songs";

const library: FileItem[] = [
  song({ title: "Hello", artists: ["Adele"] }),
  song({ title: "Skyfall", artists: ["Adele"] }),
  song({ title: "Duet", artists: ["Adele", "Bono"] }),
  song({ title: "One", artists: ["Bono"] }),
];

const makeProps = (config: Partial<UserConfig> = {}) => ({
  type: "artist" as const,
  allTracks: library,
  searchQuery: "",
  sortBy: "alphabet" as const,
  sortDescending: false,
  config: makeConfig(config),
  themeColor: "#000",
  onGroupSelect: vi.fn(),
  onGoBack: vi.fn(),
  setSearchQuery: vi.fn(),
  setSortBy: vi.fn(),
  setSortDescending: vi.fn(),
  normalizeGenre,
  handleFileSelect: vi.fn(),
});

const renderArtist = (name: string, config: Partial<UserConfig> = {}) => {
  const props = makeProps(config);
  const user = userEvent.setup();
  const view = render(<GroupedView {...props} selectedGroup={{ type: "artist", name }} />);
  return { user, props, ...view };
};

const withInfo = (info: Record<string, ArtistInfo>) =>
  installApi({ getArtistInfo: async (name) => info[name] ?? { name } });
const bioBox = () => screen.getByPlaceholderText("Write a biography for this artist...");

describe("a group's page", () => {
  it("a double-click plays a song with the group's songs as the queue", async () => {
    const { user, props } = renderArtist("Adele");
    await user.click(screen.getByText("Hello"));
    expect(props.handleFileSelect).not.toHaveBeenCalled();
    await user.dblClick(screen.getByText("Hello"));
    expect(props.handleFileSelect).toHaveBeenCalledWith(library[0], [
      library[2],
      library[0],
      library[1],
    ]);
  });

  it("plays on a single click when double-click to play is off", async () => {
    const { user, props } = renderArtist("Adele", { doubleClickToPlay: false });
    await user.click(screen.getByText("Skyfall"));
    expect(props.handleFileSelect).toHaveBeenCalledWith(library[1], expect.any(Array));
  });
});

describe("an artist's bio and picture", () => {
  it("saves an edited bio; Cancel discards the draft", async () => {
    withInfo({ Adele: { name: "Adele", bio: "Singer." } });
    const { user } = renderArtist("Adele");
    await user.click(await screen.findByRole("button", { name: /edit bio/i }));
    await user.type(bioBox(), " Draft");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fakeApi().updateArtistInfo).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /edit bio/i }));
    expect(bioBox()).toHaveValue("Singer.");
    await user.clear(bioBox());
    await user.type(bioBox(), "British singer.");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(fakeApi().updateArtistInfo).toHaveBeenCalledWith("Adele", { bio: "British singer." });
  });

  it("a draft is discarded when another artist opens, never saved onto it", async () => {
    withInfo({ Adele: { name: "Adele", bio: "Singer." }, Bono: { name: "Bono", bio: "U2." } });
    const { user, props, rerender } = renderArtist("Adele");
    await user.click(await screen.findByRole("button", { name: /edit bio/i }));
    await user.type(bioBox(), " Draft");

    rerender(<GroupedView {...props} selectedGroup={{ type: "artist", name: "Bono" }} />);
    expect(await screen.findByText("U2.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write a biography for this artist...")).toBeNull();
    expect(fakeApi().updateArtistInfo).not.toHaveBeenCalled();
  });

  it("ignores the info of an artist that was already left", async () => {
    let answerAdele!: (info: ArtistInfo) => void;
    installApi({
      getArtistInfo: (name) =>
        name === "Adele"
          ? new Promise((resolve) => (answerAdele = resolve))
          : Promise.resolve({ name, bio: "U2." }),
    });
    const { props, rerender } = renderArtist("Adele");
    rerender(<GroupedView {...props} selectedGroup={{ type: "artist", name: "Bono" }} />);
    expect(await screen.findByText("U2.")).toBeInTheDocument();
    await act(async () => answerAdele({ name: "Adele", bio: "Singer." }));
    expect(screen.queryByText("Singer.")).toBeNull();
  });

  it("changes the picture through the image picker; cancelling changes nothing", async () => {
    withInfo({});
    const { user } = renderArtist("Bono");
    await user.click(await screen.findByRole("button", { name: "Change Photo" }));
    expect(fakeApi().updateArtistInfo).not.toHaveBeenCalled();

    fakeApi().selectArtistImage.mockResolvedValue("C:\\art\\new.png");
    await user.click(screen.getByRole("button", { name: "Change Photo" }));
    await waitFor(() =>
      expect(fakeApi().updateArtistInfo).toHaveBeenCalledWith("Bono", {
        picture: "C:\\art\\new.png",
      }),
    );
  });
});
