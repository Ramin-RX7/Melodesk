// LibraryFoldersView.tsx

import { IoFolder, IoClose } from "react-icons/io5";
import { colors } from "../theme/colors";
import { LibraryViewProps } from "./LibraryView";

type Props = Pick<LibraryViewProps, "config" | "themeColor" | "onOpenFolder" | "onScrollRef"> & {
  handleAddFolder: () => void;
  handleRefreshLibrary: () => void;
  handleRemoveFolder: (e: React.MouseEvent, path: string) => void;
};

export function LibraryFoldersView({
  config,
  themeColor,
  handleAddFolder,
  handleRefreshLibrary,
  onOpenFolder,
  onScrollRef,
  handleRemoveFolder,
}: Props) {
  return (
    <div
      ref={onScrollRef}
      style={{ padding: "30px", overflowY: "auto", height: "100%", paddingBottom: "120px" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "30px",
        }}
      >
        <h2 style={{ margin: 0 }}>Library Folders</h2>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleRefreshLibrary}
            style={{
              backgroundColor: colors.borderSubtle,
              color: colors.textPrimary,
              border: "none",
              padding: "10px 20px",
              borderRadius: "20px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Refresh Library
          </button>

          <button
            onClick={handleAddFolder}
            style={{
              backgroundColor: themeColor,
              color: colors.textPrimary,
              border: "none",
              padding: "10px 20px",
              borderRadius: "20px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Add Folder
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "20px",
        }}
      >
        {config?.libraryPaths.map((path) => (
          <div
            key={path}
            onClick={() => onOpenFolder(path)}
            style={{
              backgroundColor: colors.bgElevated,
              padding: "20px",
              borderRadius: "10px",
              cursor: "pointer",
              position: "relative",
              border: `1px solid ${colors.borderSubtle}`,
            }}
          >
            <div style={{ fontSize: "40px", marginBottom: "10px", color: themeColor }}>
              <IoFolder />
            </div>

            <div
              style={{
                fontWeight: "bold",
                marginBottom: "5px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {path.split(/[\\/]/).pop()}
            </div>

            <div
              style={{
                fontSize: "12px",
                color: colors.textDim,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {path}
            </div>

            <button
              onClick={(e) => handleRemoveFolder(e, path)}
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                background: "none",
                border: "none",
                color: colors.textFaint,
                cursor: "pointer",
              }}
            >
              <IoClose />
            </button>
          </div>
        ))}

        {(!config || config.libraryPaths.length === 0) && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "50px",
              color: colors.textFaint,
            }}
          >
            No folders added to library. Click "Add Folder" to start.
          </div>
        )}
      </div>
    </div>
  );
}
