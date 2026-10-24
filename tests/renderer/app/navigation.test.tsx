import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import css from "../../../src/renderer/components/GroupedView/GroupedView.module.css";
import { playbackBar, renderApp } from "../../helpers/app";
import { mediaUrl, song } from "../../helpers/songs";

const alpha = song({ title: "Alpha", artists: ["Ann"] });
const beta = song({ title: "Beta", artists: ["Ann"] });
const gamma = song({ title: "Gamma", artists: ["Cy"] });
const library = [alpha, beta, gamma];

const heading = (name: string) => screen.findByRole("heading", { name });
/** A navbar tab. */
const tab = (name: string) => within(screen.getByRole("navigation")).getByText(name);
const goBackButton = () => screen.getByRole("button", { name: "Go back" });

describe("navigation and Back", () => {
  it("Back returns through tabs, an artist and a song's details: button, Escape and mouse", async () => {
    const { user, api } = await renderApp({ library });
    await user.click(tab("Artists"));
    await user.click(await screen.findByText("Ann"));
    await heading("Ann");
    api.showSongContextMenu.mockResolvedValueOnce({ type: "open-details" });
    fireEvent.contextMenu(screen.getByText("Beta"));
    await heading("Beta");

    await user.click(screen.getByRole("button", { name: /^back$/i }));
    await heading("Ann");
    await user.keyboard("{Escape}");
    await heading("Artists");
    act(() => fireEvent.mouseUp(window, { button: 3 }));
    await heading("Home");
    expect(goBackButton()).toBeDisabled();
  });

  it("restores where the page was scrolled to", async () => {
    const { user } = await renderApp({ library });
    await user.click(tab("Artists"));
    await heading("Artists");
    (document.querySelector(`.${css.scrollArea}`) as HTMLElement).scrollTop = 300;

    await user.click(screen.getByText("Cy"));
    await heading("Cy");
    await user.click(goBackButton());
    await heading("Artists");
    const restored = document.querySelector(`.${css.scrollArea}`) as HTMLElement;
    await waitFor(() => expect(restored.scrollTop).toBe(300));
  });

  it("remembers only as many steps as the setting allows", async () => {
    const { user } = await renderApp({ library, config: { navigationHistorySize: 1 } });
    await user.click(tab("Artists"));
    await user.click(tab("Albums"));
    await heading("Albums");
    await user.click(goBackButton());
    await heading("Artists");
    expect(goBackButton()).toBeDisabled();
  });

  it("Home's Show all page and a library folder are pages Back returns from", async () => {
    const { user } = await renderApp({
      library,
      config: { homeItemLimit: 1, libraryPaths: ["D:\\Music"] },
    });
    await user.click(screen.getAllByRole("button", { name: "Show all" })[0]);
    await heading("Most Popular Artists");
    await user.keyboard("{Escape}");
    await heading("Home");

    await user.click(tab("Library"));
    await user.click(await screen.findByText("Music"));
    expect(screen.queryByRole("heading", { name: "Library Folders" })).toBeNull();
    await user.click(goBackButton());
    await heading("Library Folders");
  });

  it("opening a song's details doesn't change the song that's playing", async () => {
    const { user, api, audio } = await renderApp({ library });
    await user.dblClick(screen.getAllByText("Alpha")[0]);
    await waitFor(() => expect(playbackBar().getByText("Alpha")).toBeInTheDocument());

    api.showSongContextMenu.mockResolvedValueOnce({ type: "open-details" });
    fireEvent.contextMenu(screen.getAllByText("Gamma")[0]);
    await heading("Gamma");
    expect(playbackBar().getByText("Alpha")).toBeInTheDocument();
    expect(audio.getAttribute("src")).toBe(mediaUrl(alpha.path));
  });
});
