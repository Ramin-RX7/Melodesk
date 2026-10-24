import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useConfirm } from "../../../src/hooks/useConfirm";
import { useToasts } from "../../../src/hooks/useToasts";
import { ConfirmOptions } from "../../../src/renderer/types";
import { fakeApi, installApi } from "../../helpers/api";

const messages = (toasts: { message: string }[]) => toasts.map((t) => t.message);

describe("useToasts", () => {
  it("shows a toast and hides it after the time for its level", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.showToast({ level: "success", message: "saved" });
      result.current.showToast({ level: "info", message: "fyi" });
      result.current.showToast({ level: "error", message: "broken" });
    });
    expect(messages(result.current.toasts)).toEqual(["saved", "fyi", "broken"]);

    act(() => vi.advanceTimersByTime(4000));
    expect(messages(result.current.toasts)).toEqual(["fyi", "broken"]);
    act(() => vi.advanceTimersByTime(1000));
    expect(messages(result.current.toasts)).toEqual(["broken"]);
    act(() => vi.advanceTimersByTime(4000));
    expect(result.current.toasts).toEqual([]);
  });

  it("shows at most 4; the oldest goes first", () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      for (let i = 1; i <= 6; i++) result.current.showToast({ level: "info", message: `m${i}` });
    });
    expect(messages(result.current.toasts)).toEqual(["m3", "m4", "m5", "m6"]);
  });

  it("dismissing a toast removes it at once", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToasts());
    act(() => result.current.showToast({ level: "info", message: "a" }));
    act(() => result.current.dismissToast(result.current.toasts[0].id));
    expect(result.current.toasts).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shows messages the main process sent before the page listened, then live ones", async () => {
    installApi({
      takePendingNotifications: async () => [{ level: "error", message: "early" }],
    });
    const { result } = renderHook(() => useToasts());
    await waitFor(() => expect(messages(result.current.toasts)).toEqual(["early"]));
    act(() => fakeApi().emit.notification({ level: "info", message: "live" }));
    expect(messages(result.current.toasts)).toEqual(["early", "live"]);
  });

  it("stops listening and clears its timers when unmounted", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useToasts());
    act(() => result.current.showToast({ level: "info", message: "a" }));
    unmount();
    expect(fakeApi().emit.count("notification")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

const question = (title: string): ConfirmOptions => ({
  title,
  message: `${title}?`,
  buttons: ["Yes", "No"],
  defaultId: 0,
  cancelId: 1,
});

describe("useConfirm", () => {
  it("asks one question at a time, in order, and resolves with the chosen button", async () => {
    const { result } = renderHook(() => useConfirm());
    let first!: Promise<number>;
    let second!: Promise<number>;
    act(() => {
      first = result.current.confirm(question("First"));
      second = result.current.confirm(question("Second"));
    });
    expect(result.current.question?.title).toBe("First");

    act(() => result.current.answer(1));
    await expect(first).resolves.toBe(1);
    expect(result.current.question?.title).toBe("Second");

    act(() => result.current.answer(0));
    await expect(second).resolves.toBe(0);
    expect(result.current.question).toBeNull();
  });

  it("answers the main process's questions with their id", () => {
    const { result } = renderHook(() => useConfirm());
    act(() => fakeApi().emit.confirmRequest({ id: 42, ...question("Replace folders") }));
    expect(result.current.question).toMatchObject({
      title: "Replace folders",
      buttons: ["Yes", "No"],
    });

    act(() => result.current.answer(0));
    expect(fakeApi().respondToConfirm).toHaveBeenCalledExactlyOnceWith(42, 0);
    expect(result.current.question).toBeNull();
  });

  it("answering with no question open does nothing", () => {
    const { result } = renderHook(() => useConfirm());
    act(() => result.current.answer(0));
    expect(fakeApi().respondToConfirm).not.toHaveBeenCalled();
  });

  it("stops listening when unmounted", () => {
    const { unmount } = renderHook(() => useConfirm());
    expect(fakeApi().emit.count("confirmRequest")).toBe(1);
    unmount();
    expect(fakeApi().emit.count("confirmRequest")).toBe(0);
  });
});
