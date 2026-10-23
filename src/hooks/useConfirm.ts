import { useCallback, useEffect, useRef, useState } from "react";

import { ConfirmOptions } from "../renderer/types";

type Question = ConfirmOptions & { key: number; answer: (response: number) => void };

/**
 * Questions for the user, shown one at a time in the app's own dialog (<ConfirmDialog>): those
 * asked by the main process (window.api.onConfirmRequest) and those asked here with `confirm`,
 * which resolves to the index of the chosen button.
 */
export function useConfirm() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const nextKey = useRef(1);

  const enqueue = useCallback((options: ConfirmOptions, answer: (response: number) => void) => {
    const key = nextKey.current++;
    setQuestions((prev) => [...prev, { ...options, key, answer }]);
  }, []);

  useEffect(
    () =>
      window.api.onConfirmRequest(({ id, ...options }) =>
        enqueue(options, (response) => window.api.respondToConfirm(id, response)),
      ),
    [enqueue],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<number>((resolve) => enqueue(options, resolve)),
    [enqueue],
  );

  const current = questions[0] ?? null;
  const answer = useCallback(
    (response: number) => {
      if (!current) return;
      setQuestions((prev) => prev.filter((q) => q.key !== current.key));
      current.answer(response);
    },
    [current],
  );

  return { question: current, answer, confirm };
}
