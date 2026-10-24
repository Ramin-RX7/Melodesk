import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DirectoryTree } from "../../../src/renderer/components/DirectoryTree";
import { LibraryView } from "../../../src/renderer/components/LibraryView";
import { FileItem } from "../../../src/renderer/types";
import { fakeApi, installApi } from "../../helpers/api";
import { makeConfig, song } from "../../helpers/songs";

const MUSIC = "D:\\Music";
const PODCASTS = "E:\\Podcasts";

const renderLibrary = (selectedLibraryPath: string | null = null) => {
  const handlers = { setConfig: vi.fn(), setSelectedLibraryPath: vi.fn() };
  const user = userEvent.setup();
  render(
    <LibraryView
      selectedLibraryPath={selectedLibraryPath}
      tree={[]}
      config={makeConfig({ libraryPaths: [MUSIC, PODCASTS] })}
      themeColor="#000"
      onOpenFolder={vi.fn()}
      onCloseFolder={vi.fn()}
      handleFileSelect={vi.fn()}
      {...handlers}
    />,
  );
  return { user, ...handlers };
};

describe("library folders", () => {
  it("adds the folders picked in the folder picker; a cancelled pick adds nothing", async () => {
    const { user, setConfig } = renderLibrary();
    await user.click(screen.getByRole("button", { name: "Add Folder" }));
    await waitFor(() => expect(fakeApi().selectDirectories).toHaveBeenCalled());
    expect(fakeApi().addLibraryFolders).not.toHaveBeenCalled();

    fakeApi().selectDirectories.mockResolvedValue(["F:\\New"]);
    await user.click(screen.getByRole("button", { name: "Add Folder" }));
    expect(fakeApi().addLibraryFolders).toHaveBeenCalledWith(["F:\\New"]);
    await waitFor(() => expect(setConfig).toHaveBeenCalled());
  });

  it("removes a folder", async () => {
    installApi({ updateConfig: async (p) => makeConfig(p) });
    const { user } = renderLibrary();
    await user.click(screen.getByRole("button", { name: `Remove ${MUSIC} from the library` }));
    expect(fakeApi().updateConfig).toHaveBeenCalledWith({ libraryPaths: [PODCASTS] });
  });
});

describe("DirectoryTree", () => {
  const file = (name: string, metadata: FileItem["metadata"] = {}): FileItem => ({
    ...song({ path: `${MUSIC}\\${name}`, ...metadata }),
    name,
  });
  const inner = file("inner.mp3", { title: "Inner" });
  const zebra = file("zebra.mp3", { title: "A song", artists: ["Zed"], duration: 61 });
  const apple = file("apple.mp3", { title: "B song", artists: ["Amy"], duration: 300 });
  const notes: FileItem = {
    name: "notes.txt",
    path: `${MUSIC}\\notes.txt`,
    isDirectory: false,
    isMedia: false,
  };
  const live: FileItem = {
    name: "Live",
    path: `${MUSIC}\\Live`,
    isDirectory: true,
    isMedia: false,
    children: [inner],
  };

  const renderTree = (useDoubleClick = true) => {
    const onFileSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <DirectoryTree
        items={[zebra, live, apple, notes]}
        onFileSelect={onFileSelect}
        useDoubleClick={useDoubleClick}
        themeColor="#000"
      />,
    );
    return { user, onFileSelect };
  };
  const names = () => screen.getAllByText(/\.(mp3|txt)$|^Live$/).map((el) => el.textContent);

  it("lists folders first; sorts by a column, reversing on a second click", async () => {
    const { user } = renderTree();
    expect(names()).toEqual(["Live", "apple.mp3", "notes.txt", "zebra.mp3"]);
    // A file without a title sorts by its name.
    await user.click(screen.getByText("Title"));
    expect(names()).toEqual(["Live", "zebra.mp3", "apple.mp3", "notes.txt"]);
    await user.click(screen.getByText("Title"));
    expect(names()).toEqual(["Live", "notes.txt", "apple.mp3", "zebra.mp3"]);
    await user.click(screen.getByText("Duration"));
    expect(names()).toEqual(["Live", "notes.txt", "zebra.mp3", "apple.mp3"]);
  });

  it("a double-click plays a song with every song in the tree as the queue", async () => {
    const { user, onFileSelect } = renderTree();
    await user.click(screen.getByText("apple.mp3"));
    expect(onFileSelect).not.toHaveBeenCalled();
    await user.dblClick(screen.getByText("apple.mp3"));
    expect(onFileSelect).toHaveBeenCalledWith(apple, [zebra, inner, apple]);
  });

  it("a single click plays when double-click to play is off; other files don't play", async () => {
    const { user, onFileSelect } = renderTree(false);
    await user.click(screen.getByText("notes.txt"));
    expect(onFileSelect).not.toHaveBeenCalled();
    await user.click(screen.getByText("zebra.mp3"));
    expect(onFileSelect).toHaveBeenCalledWith(zebra, expect.any(Array));
  });
});
