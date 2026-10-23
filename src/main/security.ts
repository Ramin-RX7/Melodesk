import { app, net, protocol, session } from "electron";
import path from "path";
import { fileURLToPath } from "url";

import { isSameOrInside } from "./services/library/libraryPaths";

// Defense in depth for the window. The app only shows its own pages, but songs and covers come
// from the user's disk, so the page is treated as if it could be compromised (e.g. through a
// decoder bug triggered by a crafted file): it can't navigate away, open windows, get
// permissions, or read files outside the app through file://. Library files are only reachable
// through media:// (see mediaAccess.ts).

// The built renderer (index.html, scripts, styles) and the app's assets.
// (This file is compiled to dist/main/; the renderer lives in dist/renderer/.)
const APP_FILES = [path.join(__dirname, "..", "renderer"), path.join(__dirname, "..", "assets")];

// Call before any window is created.
export const applySecurityPolicies = () => {
  protocol.handle("file", (request) => {
    let filePath: string;
    try {
      filePath = fileURLToPath(request.url);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    if (!APP_FILES.some((folder) => isSameOrInside(filePath, folder))) {
      console.error(`Refused file:// request outside the app: ${filePath}`);
      return new Response("Forbidden", { status: 403 });
    }
    return net.fetch(request, { bypassCustomProtocolHandlers: true });
  });

  // No camera, microphone, notifications, geolocation… the app needs none of them.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );

  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    // Also stops a file dropped outside the drop handler from replacing the app with that file.
    contents.on("will-navigate", (event) => event.preventDefault());
    contents.on("will-attach-webview", (event) => event.preventDefault());
  });
};
