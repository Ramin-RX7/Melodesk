import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlaybackBar } from "../../../src/renderer/components/PlaybackBar";
import { playTo } from "../../helpers/audio";
import { song } from "../../helpers/songs";

const renderBar = () => {
  const audio = document.createElement("audio");
  const handlers = { onSeek: vi.fn(), onVolumeChange: vi.fn(), onVolumeCommit: vi.fn() };
  render(
    <PlaybackBar
      isPlaying={false}
      currentTrack={song()}
      audioRef={{ current: audio }}
      duration={600}
      isShuffle={false}
      repeatMode="none"
      volume={0.5}
      themeColor="#000"
      onTogglePlay={vi.fn()}
      onShowDetails={vi.fn()}
      onShowLyrics={vi.fn()}
      onNext={vi.fn()}
      onPrevious={vi.fn()}
      onToggleShuffle={vi.fn()}
      onToggleRepeat={vi.fn()}
      onShowQueue={vi.fn()}
      {...handlers}
    />,
  );
  return { audio, ...handlers };
};

describe("PlaybackBar", () => {
  it("a click on the seek bar seeks", () => {
    const { onSeek } = renderBar();
    fireEvent.change(screen.getByRole("slider", { name: "Seek" }), { target: { value: "100" } });
    expect(onSeek).toHaveBeenCalledWith(100);
  });

  it("dragging the seek bar seeks once, on release, and playback doesn't move the handle", () => {
    const { onSeek, audio } = renderBar();
    const seek = screen.getByRole("slider", { name: "Seek" });
    fireEvent.mouseDown(seek);
    fireEvent.input(seek, { target: { value: "200" } });
    fireEvent.input(seek, { target: { value: "300" } });
    act(() => playTo(audio, 10));
    expect(seek).toHaveValue("300");
    expect(onSeek).not.toHaveBeenCalled();
    fireEvent.mouseUp(seek);
    expect(onSeek).toHaveBeenCalledExactlyOnceWith(300);
  });

  it("the volume changes live and is saved on release, by mouse or keyboard", () => {
    const { onVolumeChange, onVolumeCommit } = renderBar();
    const volume = screen.getByRole("slider", { name: "Volume" });
    fireEvent.change(volume, { target: { value: "0.2" } });
    fireEvent.change(volume, { target: { value: "0.3" } });
    expect(onVolumeChange.mock.calls.flat()).toEqual([0.2, 0.3]);
    expect(onVolumeCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(volume);
    expect(onVolumeCommit).toHaveBeenLastCalledWith(0.3);
    fireEvent.keyUp(volume, { key: "ArrowUp" });
    expect(onVolumeCommit).toHaveBeenCalledTimes(2);
  });
});
