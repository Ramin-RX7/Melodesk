import { useEffect } from "react";
import { UserConfig } from "../renderer/types";
import { EQ_FREQUENCIES, FLAT, normalizeBands } from "../utils/equalizer";

type EqGraph = {
  ctx: AudioContext;
  source: MediaElementAudioSourceNode;
  filters: BiquadFilterNode[];
};

// Keyed by the audio element so the graph is built exactly once per element,
// surviving React re-renders and StrictMode's mount/unmount/remount cycle.
// createMediaElementSource throws if called twice on the same element.
const graphs = new WeakMap<HTMLMediaElement, EqGraph>();

function buildGraph(el: HTMLMediaElement): EqGraph {
  const existing = graphs.get(el);
  if (existing) return existing;

  const Ctor: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new Ctor();
  const source = ctx.createMediaElementSource(el);

  // One peaking filter per band, chained in series:
  // source -> f[0] -> f[1] -> ... -> f[n] -> destination
  const filters = EQ_FREQUENCIES.map((freq) => {
    const f = ctx.createBiquadFilter();
    f.type = "peaking";
    f.frequency.value = freq;
    f.Q.value = 1.0;
    f.gain.value = 0;
    return f;
  });

  source.connect(filters[0]);
  for (let i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1]);
  }
  filters[filters.length - 1].connect(ctx.destination);

  const graph: EqGraph = { ctx, source, filters };
  graphs.set(el, graph);
  return graph;
}

/**
 * Inserts a 10-band graphic equalizer (Web Audio API) between the shared
 * <audio> element and the speakers, and keeps its band gains in sync with the
 * user's config. The element's own `volume` still acts as master volume since
 * it is applied before the MediaElementAudioSourceNode.
 */
export function useEqualizer(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  config: UserConfig | null,
) {
  const enabled = !!config?.equalizerEnabled;
  const bands = config?.equalizerBands;

  // Build the graph and wire resume-on-play once the element exists. The
  // AudioContext starts "suspended" under the autoplay policy; resuming on the
  // user-initiated play gesture is what gets audio flowing.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const graph = buildGraph(el);

    const onPlay = () => {
      if (graph.ctx.state === "suspended") graph.ctx.resume().catch(() => {});
    };
    el.addEventListener("play", onPlay);
    if (!el.paused) onPlay(); // playback may have started before this ran

    return () => el.removeEventListener("play", onPlay);
  }, [audioRef]);

  // Apply gains live whenever EQ settings change. When disabled we drive all
  // bands to 0 dB (a transparent curve) rather than tearing down the graph.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const graph = graphs.get(el);
    if (!graph) return;

    const target = enabled ? normalizeBands(bands) : FLAT;
    const now = graph.ctx.currentTime;
    graph.filters.forEach((f, i) => {
      // setTargetAtTime ramps smoothly to avoid zipper noise on slider drags.
      f.gain.setTargetAtTime(target[i], now, 0.01);
    });
  }, [audioRef, enabled, bands]);
}
