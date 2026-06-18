import { FileItem, UserConfig } from "../../types";
import styles from "./Navbar.module.css";
import { navItems } from "./navConfig";
import { Page, NavTab } from "./types";
import { GlobalSearch, GlobalSearchNavTarget } from "../GlobalSearch/GlobalSearch";

type Props = {
  activeTab: Page;
  themeColor: string;
  onTabChange: (tab: NavTab) => void;
  onQueueClick: () => void;
  allTracks: FileItem[];
  config: UserConfig | null;
  onPlaySong: (song: FileItem, queue: FileItem[]) => void;
  onGlobalSearchNavigate: (target: GlobalSearchNavTarget) => void;
};

export function Navbar({
  activeTab,
  themeColor,
  onTabChange,
  onQueueClick,
  allTracks,
  config,
  onPlaySong,
  onGlobalSearchNavigate,
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

      <GlobalSearch
        allTracks={allTracks}
        config={config}
        themeColor={themeColor}
        onPlaySong={onPlaySong}
        onNavigate={onGlobalSearchNavigate}
      />

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
