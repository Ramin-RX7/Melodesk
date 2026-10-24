// Media for renderer tests. jsdom has an <audio> element but doesn't play anything: play(),
// pause() and load() aren't implemented, `duration` is NaN, `paused` is always true and no media
// events fire. stubMedia() (run before every renderer test) makes the element behave enough for
// the app's hooks; tests set the state with setMedia() and fire the events with fire().
// Web Audio (the equalizer) and the OS media session get small recording fakes.
import { vi } from "vitest";

type MediaState = { duration: number; paused: boolean };
const state = new WeakMap<HTMLMediaElement, MediaState>();
const stateOf = (el: HTMLMediaElement) => {
  let s = state.get(el);
  if (!s) state.set(el, (s = { duration: NaN, paused: true }));
  return s;
};

/** What the next play() call does: resolve (default) or reject with an error of that name. */
let nextPlay: { reject?: string } = {};
export const rejectNextPlay = (errorName: string) => (nextPlay = { reject: errorName });

export const stubMedia = () => {
  nextPlay = {};
  const proto = HTMLMediaElement.prototype;
  Object.defineProperty(proto, "duration", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return stateOf(this).duration;
    },
  });
  Object.defineProperty(proto, "paused", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return stateOf(this).paused;
    },
  });
  proto.play = vi.fn(function (this: HTMLMediaElement) {
    const { reject } = nextPlay;
    nextPlay = {};
    if (reject) return Promise.reject(Object.assign(new Error(reject), { name: reject }));
    stateOf(this).paused = false;
    return Promise.resolve();
  });
  proto.pause = vi.fn(function (this: HTMLMediaElement) {
    stateOf(this).paused = true;
  });
  proto.load = vi.fn();
};

/** Sets what the element reports: its length, position and whether it's playing. */
export const setMedia = (
  el: HTMLMediaElement,
  values: { duration?: number; currentTime?: number; paused?: boolean },
) => {
  const s = stateOf(el);
  if (values.duration !== undefined) s.duration = values.duration;
  if (values.paused !== undefined) s.paused = values.paused;
  if (values.currentTime !== undefined) el.currentTime = values.currentTime;
};

/** Fires a media event (loadedmetadata, timeupdate, seeked, loadstart, play, pause…). */
export const fire = (el: HTMLMediaElement, event: string) => el.dispatchEvent(new Event(event));

/** Moves the position and fires the events the browser would ("timeupdate", or "seeked"). */
export const playTo = (el: HTMLMediaElement, time: number, event = "timeupdate") => {
  el.currentTime = time;
  fire(el, event);
};

// --- Web Audio --------------------------------------------------------------------------------

class FakeParam {
  value = 0;
  setTargetAtTime = vi.fn((value: number) => {
    this.value = value;
  });
}

class FakeNode {
  connections: unknown[] = [];
  connect = vi.fn((node: unknown) => {
    this.connections.push(node);
    return node;
  });
}

class FakeFilter extends FakeNode {
  type = "lowpass";
  frequency = new FakeParam();
  Q = new FakeParam();
  gain = new FakeParam();
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: "suspended" | "running" = "suspended";
  currentTime = 0;
  destination = new FakeNode();
  sources: { element: HTMLMediaElement; node: FakeNode }[] = [];
  filters: FakeFilter[] = [];
  resume = vi.fn(async () => {
    this.state = "running";
  });

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createMediaElementSource(element: HTMLMediaElement) {
    if (this.sources.some((s) => s.element === element)) {
      throw new Error("HTMLMediaElement already connected previously");
    }
    const node = new FakeNode();
    this.sources.push({ element, node });
    return node;
  }

  createBiquadFilter() {
    const filter = new FakeFilter();
    this.filters.push(filter);
    return filter;
  }
}

export const stubAudioContext = () => {
  FakeAudioContext.instances = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
};

// --- OS media session -------------------------------------------------------------------------

export type FakeMediaSession = {
  metadata: { title: string; artist: string; album: string; artwork?: unknown[] } | null;
  handlers: Record<string, () => void>;
  setActionHandler: (action: string, handler: () => void) => void;
};

/** Adds navigator.mediaSession and MediaMetadata (jsdom has neither); only for tests that need it. */
export const stubMediaSession = (): FakeMediaSession => {
  const session: FakeMediaSession = {
    metadata: null,
    handlers: {},
    setActionHandler: (action, handler) => (session.handlers[action] = handler),
  };
  Object.defineProperty(navigator, "mediaSession", { configurable: true, value: session });
  vi.stubGlobal(
    "MediaMetadata",
    class {
      constructor(init: object) {
        Object.assign(this, init);
      }
    },
  );
  return session;
};

export const removeMediaSession = () => {
  delete (navigator as { mediaSession?: unknown }).mediaSession;
};
