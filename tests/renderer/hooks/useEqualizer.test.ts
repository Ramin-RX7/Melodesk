import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useEqualizer } from "../../../src/hooks/useEqualizer";
import { UserConfig } from "../../../src/renderer/types";
import { EQ_FREQUENCIES } from "../../../src/utils/equalizer";
import { FakeAudioContext, fire, setMedia } from "../../helpers/audio";
import { makeConfig } from "../../helpers/songs";

// The graph is remembered per element for the whole test file, so every test uses a new one.
const setup = (config: UserConfig | null = makeConfig()) => {
  const audio = document.createElement("audio");
  const ref = { current: audio };
  const hook = renderHook(({ c }) => useEqualizer(ref, c), { initialProps: { c: config } });
  const ctx = FakeAudioContext.instances.at(-1)!;
  const gains = () => ctx.filters.map((f) => f.gain.value);
  return { audio, ref, ctx, gains, ...hook };
};

const BOOST = [6, 5, 4, 2, 0, 0, 1, 2, 3, 4];

describe("useEqualizer", () => {
  it("puts 10 filters in series between the song and the speakers", () => {
    const { ctx, audio } = setup();
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0].element).toBe(audio);
    expect(ctx.filters.map((f) => f.frequency.value)).toEqual(EQ_FREQUENCIES);
    expect(ctx.filters.every((f) => f.type === "peaking")).toBe(true);

    expect(ctx.sources[0].node.connections).toEqual([ctx.filters[0]]);
    ctx.filters.slice(0, -1).forEach((f, i) => expect(f.connections).toEqual([ctx.filters[i + 1]]));
    expect(ctx.filters.at(-1)!.connections).toEqual([ctx.destination]);
  });

  it("builds the graph only once per element, even when remounted", () => {
    const { ref, unmount } = setup();
    unmount();
    renderHook(() => useEqualizer(ref, makeConfig()));
    expect(FakeAudioContext.instances).toHaveLength(1);
  });

  it("applies the bands when enabled, and a flat curve when disabled", () => {
    const { rerender, gains, ctx } = setup(
      makeConfig({ equalizerEnabled: true, equalizerBands: BOOST }),
    );
    expect(gains()).toEqual(BOOST);

    rerender({ c: makeConfig({ equalizerEnabled: false, equalizerBands: BOOST }) });
    expect(gains()).toEqual(Array(10).fill(0));
    // Changes ramp smoothly instead of jumping.
    expect(ctx.filters[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.01);
  });

  it("clamps out-of-range and missing band values", () => {
    const { gains } = setup(
      makeConfig({ equalizerEnabled: true, equalizerBands: [99, -99, 3] as number[] }),
    );
    expect(gains()).toEqual([12, -12, 3, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("resumes the audio when playback starts", () => {
    const { ctx, audio } = setup();
    expect(ctx.resume).not.toHaveBeenCalled();
    fire(audio, "play");
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    fire(audio, "play");
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it("resumes at once when the song was already playing", () => {
    const audio = document.createElement("audio");
    setMedia(audio, { paused: false });
    renderHook(() => useEqualizer({ current: audio }, makeConfig()));
    expect(FakeAudioContext.instances.at(-1)!.resume).toHaveBeenCalled();
  });

  it("does nothing without an element", () => {
    renderHook(() => useEqualizer({ current: null }, makeConfig()));
    expect(FakeAudioContext.instances).toHaveLength(0);
  });
});
