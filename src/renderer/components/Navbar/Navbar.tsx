import { IoSettingsSharp } from "react-icons/io5";

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
  onSettingsClick: () => void;
  allTracks: FileItem[];
  config: UserConfig | null;
  onPlaySong: (song: FileItem, queue: FileItem[]) => void;
  onGlobalSearchNavigate: (target: GlobalSearchNavTarget) => void;
  canGoBack: boolean;
  onGoBack: () => void;
};

export function Navbar({
  activeTab,
  themeColor,
  onTabChange,
  onQueueClick,
  onSettingsClick,
  allTracks,
  config,
  onPlaySong,
  onGlobalSearchNavigate,
  canGoBack,
  onGoBack,
}: Props) {
  return (
    <nav className={styles.nav}>
      <button
        className={styles.backButton}
        onClick={onGoBack}
        disabled={!canGoBack}
        title="Go back"
        style={{ color: canGoBack ? themeColor : "#444" }}
      >
        ‹
      </button>

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

      <div
        className={styles.navItem}
        onClick={onSettingsClick}
        title="Settings"
        style={{
          display: "flex",
          alignItems: "center",
          color: activeTab === "settings" ? "#fff" : "#888",
          borderBottomColor: activeTab === "settings" ? themeColor : "transparent",
        }}
      >
        <IoSettingsSharp size={18} />
      </div>
    </nav>
  );
}
