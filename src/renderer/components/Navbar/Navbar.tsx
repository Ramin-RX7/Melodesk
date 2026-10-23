import React from "react";
import { IoSettingsSharp } from "react-icons/io5";

import { FileItem, UserConfig } from "../../types";
import { colors } from "../../theme/colors";
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
  onSongContextMenu?: (e: React.MouseEvent, song: FileItem) => void;
  onGroupContextMenu?: (e: React.MouseEvent, name: string, songs: FileItem[]) => void;
  onGlobalSearchNavigate: (target: GlobalSearchNavTarget) => void;
  canGoBack: boolean;
  onGoBack: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
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
  onSongContextMenu,
  onGroupContextMenu,
  onGlobalSearchNavigate,
  canGoBack,
  onGoBack,
  searchInputRef,
}: Props) {
  return (
    <nav className={styles.nav}>
      <button
        className={styles.backButton}
        onClick={onGoBack}
        disabled={!canGoBack}
        title="Go back"
        style={{ color: canGoBack ? themeColor : colors.border }}
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
              color: isActive ? colors.textPrimary : colors.textDim,
              fontWeight: isActive ? "bold" : "normal",
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
        onSongContextMenu={onSongContextMenu}
        onGroupContextMenu={onGroupContextMenu}
        onNavigate={onGlobalSearchNavigate}
        inputRef={searchInputRef}
      />

      <div
        className={`${styles.navItem} ${styles.queueItem}`}
        onClick={onQueueClick}
        style={{
          borderBottomColor: activeTab === "queue" ? themeColor : "transparent",
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
          color: activeTab === "settings" ? colors.textPrimary : colors.textDim,
          borderBottomColor: activeTab === "settings" ? themeColor : "transparent",
        }}
      >
        <IoSettingsSharp size={18} />
      </div>
    </nav>
  );
}
