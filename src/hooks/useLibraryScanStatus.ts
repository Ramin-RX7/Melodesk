import { useEffect, useState } from "react";

import { LibraryScanStatus } from "../renderer/types";

const IDLE: LibraryScanStatus = { scanning: false, processed: 0, total: 0 };

// Live status of the background library scan. The initial fetch matters: the startup scan
// begins before the window exists, so its first events are sent before we subscribe.
export function useLibraryScanStatus(): LibraryScanStatus {
  const [status, setStatus] = useState<LibraryScanStatus>(IDLE);

  useEffect(() => {
    let active = true;
    const unsubscribe = window.api.onLibraryScanStatus((next) => setStatus(next));
    window.api.getLibraryScanStatus().then((initial) => {
      if (active) setStatus(initial);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return status;
}
