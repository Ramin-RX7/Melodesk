import { useCallback, useEffect, useRef, useState } from "react";

import { AppNotification } from "../renderer/types";

export type Toast = AppNotification & { id: number };

const DURATION_MS: Record<AppNotification["level"], number> = {
  info: 5000,
  success: 4000,
  error: 9000,
};
const MAX_VISIBLE = 4;

// Toast queue for the whole app. UI code calls `showToast`; messages from the main process
// (folder changes, damaged playlists, …) arrive through window.api.onNotification.
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (notification: AppNotification) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { ...notification, id }].slice(-MAX_VISIBLE));
      timers.current.set(
        id,
        setTimeout(() => dismissToast(id), DURATION_MS[notification.level]),
      );
    },
    [dismissToast],
  );

  useEffect(() => {
    const unsubscribe = window.api.onNotification(showToast);
    window.api.takePendingNotifications().then((pending) => pending.forEach(showToast));
    return unsubscribe;
  }, [showToast]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return { toasts, showToast, dismissToast };
}
