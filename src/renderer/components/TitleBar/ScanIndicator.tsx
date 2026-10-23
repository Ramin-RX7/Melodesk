import { LibraryScanStatus } from "../../types";
import styles from "./ScanIndicator.module.css";

type Props = {
  status: LibraryScanStatus;
  themeColor: string;
  onClick: () => void;
};

// Shown in the title bar while the library is being scanned in the background.
export function ScanIndicator({ status, themeColor, onClick }: Props) {
  if (!status.scanning) return null;

  const progress =
    status.phase === "reading"
      ? `${status.processed.toLocaleString()} / ${status.total.toLocaleString()}`
      : `${status.total.toLocaleString()} found`;

  return (
    <div
      className={styles.scanIndicator}
      onClick={onClick}
      title={status.currentPath ? `Reading ${status.currentPath}` : "Scanning library"}
    >
      <span className={styles.spinner} style={{ borderTopColor: themeColor }} />
      <span>Scanning library… {progress}</span>
    </div>
  );
}
