import { ipcMain, WebContents } from "electron";

import { ConfirmOptions } from "../../renderer/types";

// Questions to the user ("Add anyway / Skip / Cancel") are shown by the app's own themed dialog,
// not a native message box: askUser sends the question to the window, which answers with the
// index of the chosen button. A window that goes away answers with `cancelId`.

type Pending = { resolve: (response: number) => void; cancelId: number };

const pending = new Map<number, Pending>();
let nextId = 1;

ipcMain.on("confirm-response", (_event, id: number, response: number) => {
  const entry = pending.get(id);
  entry?.resolve(Number.isInteger(response) ? response : entry.cancelId);
});

export const askUser = (
  target: WebContents | null,
  options: ConfirmOptions,
): Promise<{ response: number }> => {
  if (!target || target.isDestroyed()) return Promise.resolve({ response: options.cancelId });

  return new Promise((resolve) => {
    const id = nextId++;
    const finish = (response: number) => {
      if (!pending.delete(id)) return;
      target.off("destroyed", onGone);
      target.off("did-finish-load", onGone);
      target.off("render-process-gone", onGone);
      resolve({ response });
    };
    const onGone = () => finish(options.cancelId);

    pending.set(id, { resolve: finish, cancelId: options.cancelId });
    target.once("destroyed", onGone);
    target.once("did-finish-load", onGone); // the page was reloaded
    target.once("render-process-gone", onGone);
    target.send("confirm-request", { id, ...options });
  });
};
