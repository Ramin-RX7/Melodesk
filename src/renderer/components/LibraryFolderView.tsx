// LibraryFolderView.tsx

import { IoArrowBack } from "react-icons/io5";
import { DirectoryTree } from "./DirectoryTree";
import { colors } from "../theme/colors";
import { LibraryViewProps } from "./LibraryView";

type Props = Pick<
  LibraryViewProps,
  | "selectedLibraryPath"
  | "onCloseFolder"
  | "onScrollRef"
  | "tree"
  | "config"
  | "themeColor"
  | "handleFileSelect"
  | "onContextMenu"
>;

export function LibraryFolderView({
  selectedLibraryPath,
  onCloseFolder,
  onScrollRef,
  tree,
  config,
  themeColor,
  handleFileSelect,
  onContextMenu,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div
        style={{
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          gap: "15px",
          borderBottom: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.bgSurface,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onCloseFolder}
          style={{
            background: "none",
            border: `1px solid ${colors.border}`,
            color: colors.textPrimary,
            padding: "4px 12px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <IoArrowBack /> Back
        </button>

        <span
          style={{
            fontSize: "13px",
            color: colors.textMuted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedLibraryPath}
        </span>
      </div>

      <div
        ref={onScrollRef}
        style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingBottom: "120px" }}
      >
        <DirectoryTree
          items={tree}
          onFileSelect={handleFileSelect}
          useDoubleClick={config?.doubleClickToPlay ?? true}
          themeColor={themeColor}
          onContextMenu={onContextMenu}
        />
      </div>
    </div>
  );
}
