import { useEffect, useRef } from "react";

import { ConfirmOptions } from "../../types";
import styles from "./ConfirmDialog.module.css";

type Props = {
  question: (ConfirmOptions & { key: number }) | null;
  themeColor: string;
  onAnswer: (response: number) => void;
};

// The app's own question dialog (instead of native message boxes). Enter picks the default
// button, Esc or a click outside picks the cancel button.
export function ConfirmDialog({ question, themeColor, onAnswer }: Props) {
  const defaultRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!question) return;
    defaultRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onAnswer(question.cancelId);
      } else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        onAnswer(question.defaultId);
      }
      // Listening in the capture phase and stopping here keeps every key inside the dialog: app
      // shortcuts (play/pause, Esc = back…) must not fire behind it. A focused button still gets
      // its own Enter/Space click.
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [question, onAnswer]);

  if (!question) return null;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => e.target === e.currentTarget && onAnswer(question.cancelId)}
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label={question.title}
      >
        <div className={styles.title}>{question.title}</div>
        <div className={styles.message}>{question.message}</div>
        {question.detail && <div className={styles.detail}>{question.detail}</div>}
        <div className={styles.buttons}>
          {question.buttons.map((label, i) => {
            const isDefault = i === question.defaultId;
            const isDanger = i === question.dangerId;
            return (
              <button
                key={i}
                ref={isDefault ? defaultRef : undefined}
                className={`${styles.button} ${isDanger ? styles.danger : isDefault ? styles.primary : ""}`}
                style={isDefault && !isDanger ? { backgroundColor: themeColor } : undefined}
                onClick={() => onAnswer(i)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
