import styles from "./Navbar.module.css";
import { navItems } from "./navConfig";
import { Page, NavTab } from "./types";

type Props = {
  activeTab: Page;
  themeColor: string;
  onTabChange: (tab: NavTab) => void;
  onQueueClick: () => void;
};

export function Navbar({
  activeTab,
  themeColor,
  onTabChange,
  onQueueClick
}: Props) {
  return (
    <nav className={styles.nav}>
      {navItems.map(({ label, tab }) => {
        const isActive = activeTab === tab;

        return (
          <div
            key={tab}
            className={styles.navItem}
            onClick={() => onTabChange(tab)}
            style={{
              borderBottomColor: isActive ? themeColor : "transparent",
              color: isActive ? "#fff" : "#888",
              fontWeight: isActive ? "bold" : "normal"
            }}
          >
            {label}
          </div>
        );
      })}

      <div
        className={`${styles.navItem} ${styles.queueItem}`}
        onClick={onQueueClick}
        style={{
          borderBottomColor:
            activeTab === "queue" ? themeColor : "transparent"
        }}
      >
        Queue
      </div>
    </nav>
  );
}