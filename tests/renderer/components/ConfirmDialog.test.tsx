import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { useKeyboardControls } from "../../../src/hooks/useKeyboardControls";
import { ConfirmDialog } from "../../../src/renderer/components/ConfirmDialog/ConfirmDialog";
import { ConfirmOptions } from "../../../src/renderer/types";

const renderDialog = (options: Partial<ConfirmOptions> = {}) => {
  const onAnswer = vi.fn();
  render(
    <ConfirmDialog
      question={{
        key: 1,
        title: "Delete playlist",
        message: 'Delete "Mix"?',
        buttons: ["Delete", "Cancel"],
        defaultId: 1,
        cancelId: 1,
        dangerId: 0,
        ...options,
      }}
      themeColor="#000"
      onAnswer={onAnswer}
    />,
  );
  return onAnswer;
};

describe("ConfirmDialog", () => {
  it("a click answers with that button", async () => {
    const onAnswer = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("Enter picks the default button (focused at start), or the focused one", async () => {
    const user = userEvent.setup();
    const onAnswer = renderDialog({ defaultId: 0, cancelId: 1 });
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(onAnswer).toHaveBeenLastCalledWith(0);

    screen.getByRole("button", { name: "Cancel" }).focus();
    await user.keyboard("{Enter}");
    expect(onAnswer).toHaveBeenLastCalledWith(1);
    expect(onAnswer).toHaveBeenCalledTimes(2);
  });

  it("Escape and a click outside pick the cancel button", () => {
    const onAnswer = renderDialog({ defaultId: 0, cancelId: 1 });
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onAnswer).toHaveBeenLastCalledWith(1);

    const dialog = screen.getByRole("alertdialog");
    fireEvent.mouseDown(dialog);
    expect(onAnswer).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(dialog.parentElement!);
    expect(onAnswer).toHaveBeenCalledTimes(2);
    expect(onAnswer).toHaveBeenLastCalledWith(1);
  });

  it("app shortcuts don't fire behind it", () => {
    const togglePlay = vi.fn();
    const goBack = vi.fn();
    renderHook(() =>
      useKeyboardControls({
        togglePlay,
        goBack,
        handleNext: vi.fn(),
        handlePrevious: vi.fn(),
        seekForward: vi.fn(),
        seekBackward: vi.fn(),
      }),
    );
    renderDialog();
    fireEvent.keyDown(document.body, { key: " ", code: "Space" });
    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    expect(togglePlay).not.toHaveBeenCalled();
    expect(goBack).not.toHaveBeenCalled();
  });
});
