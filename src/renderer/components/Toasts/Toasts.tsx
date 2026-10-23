import { IoAlertCircle, IoCheckmarkCircle, IoClose, IoInformationCircle } from "react-icons/io5";

import { Toast } from "../../../hooks/useToasts";
import { colors } from "../../theme/colors";
import styles from "./Toasts.module.css";

type Props = {
  toasts: Toast[];
  themeColor: string;
  onDismiss: (id: number) => void;
};

export function Toasts({ toasts, themeColor, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => {
        const accent = toast.level === "error" ? colors.danger : themeColor;
        const Icon =
          toast.level === "error"
            ? IoAlertCircle
            : toast.level === "success"
              ? IoCheckmarkCircle
              : IoInformationCircle;

        return (
          <div
            key={toast.id}
            className={styles.toast}
            style={{ borderLeftColor: accent }}
            role={toast.level === "error" ? "alert" : "status"}
          >
            <Icon className={styles.icon} style={{ color: accent }} />
            <span className={styles.message}>{toast.message}</span>
            <button className={styles.close} onClick={() => onDismiss(toast.id)} title="Dismiss">
              <IoClose />
            </button>
          </div>
        );
      })}
    </div>
  );
}
