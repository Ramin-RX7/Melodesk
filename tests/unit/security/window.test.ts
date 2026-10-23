// security.ts (file://, navigation, popups, permissions) and confirmService (questions to the
// user answered in the page).
import path from "node:path";
import { pathToFileURL } from "node:url";
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { freshMain } from "../../helpers/main";

let electron: Awaited<ReturnType<typeof freshMain>>;

beforeEach(async () => {
  electron = await freshMain();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("applySecurityPolicies", () => {
  const load = async () => {
    const { applySecurityPolicies } = await import("../../../src/main/security");
    applySecurityPolicies();
  };

  // security.ts lives in src/main, so the app files it allows are src/renderer and src/assets
  // here (dist/renderer and dist/assets in the built app).
  const appFile = path.resolve("src", "renderer", "index.html");

  it("serves the app's own files through file://", async () => {
    await load();
    const handler = electron.protocolHandlers.get("file")!;
    const response = await handler(new Request(pathToFileURL(appFile).href));
    expect(response.status).toBe(200);
    expect(electron.net.fetch).toHaveBeenCalledTimes(1);
    expect(electron.net.fetch.mock.calls[0][1]).toEqual({ bypassCustomProtocolHandlers: true });
  });

  it("refuses any other file:// request", async () => {
    await load();
    const handler = electron.protocolHandlers.get("file")!;
    for (const target of [
      path.resolve("package.json"),
      path.resolve("src", "renderer", "..", "main.ts"),
      path.resolve("src", "renderer-evil", "x.js"),
    ]) {
      const response = await handler(new Request(pathToFileURL(target).href));
      expect(response.status, target).toBe(403);
    }
    expect(electron.net.fetch).not.toHaveBeenCalled();
  });

  it("denies every permission request", async () => {
    await load();
    const [[handler]] = electron.session.defaultSession.setPermissionRequestHandler.mock.calls;
    const callback = vi.fn();
    handler({}, "media", callback);
    expect(callback).toHaveBeenCalledWith(false);
  });

  it("blocks popups, navigation and webviews in every page", async () => {
    await load();
    const [, onCreated] = electron.app.on.mock.calls.find(
      ([event]) => event === "web-contents-created",
    )!;
    const contents = Object.assign(new EventEmitter(), {
      setWindowOpenHandler: vi.fn((_handler: () => unknown) => {}),
    });
    (onCreated as (event: unknown, contents: unknown) => void)({}, contents);

    expect(contents.setWindowOpenHandler.mock.calls[0][0]()).toEqual({ action: "deny" });
    for (const event of ["will-navigate", "will-attach-webview"]) {
      const preventDefault = vi.fn();
      contents.emit(event, { preventDefault });
      expect(preventDefault, event).toHaveBeenCalled();
    }
  });
});

describe("askUser", () => {
  const question = {
    title: "Q",
    message: "Really?",
    buttons: ["Yes", "No"],
    defaultId: 0,
    cancelId: 1,
  };

  it("asks the page and resolves with the chosen button", async () => {
    const { askUser } = await import("../../../src/main/services/confirmService");
    const win = electron.openWindow();
    const answer = askUser(win.webContents as never, question);
    const [request] = win.webContents.sentOn<{ id: number; message: string }>("confirm-request");
    expect(request.message).toBe("Really?");
    electron.send("confirm-response", request.id, 0);
    expect(await answer).toEqual({ response: 0 });
  });

  it("treats a malformed answer as cancel", async () => {
    const { askUser } = await import("../../../src/main/services/confirmService");
    const win = electron.openWindow();
    const answer = askUser(win.webContents as never, question);
    const [request] = win.webContents.sentOn<{ id: number }>("confirm-request");
    electron.send("confirm-response", request.id, "yes please");
    expect(await answer).toEqual({ response: 1 });
  });

  it.each(["destroyed", "did-finish-load", "render-process-gone"])(
    "cancels when the page goes away (%s)",
    async (event) => {
      const { askUser } = await import("../../../src/main/services/confirmService");
      const win = electron.openWindow();
      const answer = askUser(win.webContents as never, question);
      win.webContents.emit(event);
      expect(await answer).toEqual({ response: 1 });
      // A late answer no longer matters, and no listeners are left behind.
      const [request] = win.webContents.sentOn<{ id: number }>("confirm-request");
      electron.send("confirm-response", request.id, 0);
      expect(win.webContents.listenerCount("destroyed")).toBe(0);
      expect(win.webContents.listenerCount("did-finish-load")).toBe(0);
    },
  );

  it("cancels at once when there is no page to ask", async () => {
    const { askUser } = await import("../../../src/main/services/confirmService");
    expect(await askUser(null, question)).toEqual({ response: 1 });
    const win = electron.openWindow();
    win.webContents.destroyed = true;
    expect(await askUser(win.webContents as never, question)).toEqual({ response: 1 });
  });
});
