import React, { useState, useMemo } from "react";
import { FileItem } from "../types";
import { IoFolder, IoFolderOpen, IoMusicalNote, IoCaretUp, IoCaretDown } from "react-icons/io5";
import { formatArtists } from "../../utils/metadata";
import { colors } from "../theme/colors";

interface DirectoryTreeProps {
  items: FileItem[];
  onFileSelect: (item: FileItem, contextQueue?: FileItem[]) => void;
  useDoubleClick: boolean;
  themeColor: string;
  onContextMenu?: (e: React.MouseEvent, song: FileItem) => void;
}

type SortColumn = "name" | "title" | "artist" | "album" | "duration";
type SortOrder = "asc" | "desc";

const TreeItem: React.FC<{
  item: FileItem;
  onFileSelect: (item: FileItem, contextQueue?: FileItem[]) => void;
  useDoubleClick: boolean;
  isRoot?: boolean;
  themeColor: string;
  allFiles: FileItem[];
  onContextMenu?: (e: React.MouseEvent, song: FileItem) => void;
}> = ({
  item,
  onFileSelect,
  useDoubleClick,
  isRoot = false,
  themeColor,
  allFiles,
  onContextMenu,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {
    if (item.isDirectory) {
      setIsOpen(!isOpen);
    } else if (item.isMedia && !useDoubleClick) {
      onFileSelect(item, allFiles);
    }
  };

  const handleDoubleClick = () => {
    if (item.isMedia && useDoubleClick) {
      onFileSelect(item, allFiles);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ marginLeft: isRoot ? 0 : 20, cursor: "pointer", color: colors.textBright }}>
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => {
          if (item.isMedia && onContextMenu) {
            onContextMenu(e, item);
          }
        }}
        style={{
          padding: "6px 8px",
          borderRadius: "4px",
          backgroundColor: "transparent",
          transition: "background-color 0.2s",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          opacity: item.isDirectory || item.isMedia ? 1 : 0.5,
          userSelect: "none",
          borderBottom: `1px solid ${colors.borderFaint}`,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.bgHover3)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "300px",
            minWidth: "300px",
            gap: "8px",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              color: item.isDirectory ? themeColor : colors.textDim,
              width: "20px",
            }}
          >
            {item.isDirectory ? isOpen ? <IoFolderOpen /> : <IoFolder /> : <IoMusicalNote />}
          </span>
          <span
            style={{
              fontWeight: item.isMedia ? "bold" : "normal",
              fontSize: "14px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.name}
          </span>
        </div>

        {!item.isDirectory && (
          <>
            <div
              style={{
                flex: 1,
                fontSize: "13px",
                color: colors.textMutedHi,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.metadata?.title || "-"}
            </div>
            <div
              title={formatArtists(item.metadata?.artists).full}
              style={{
                flex: 1,
                fontSize: "13px",
                color: colors.textDim,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {formatArtists(item.metadata?.artists).display}
            </div>
            <div
              style={{
                flex: 1,
                fontSize: "13px",
                color: colors.textDim,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.metadata?.album || "-"}
            </div>
            <div
              style={{
                width: "60px",
                fontSize: "13px",
                color: colors.textFaint,
                textAlign: "right",
              }}
            >
              {formatDuration(item.metadata?.duration)}
            </div>
          </>
        )}
      </div>
      {item.isDirectory && isOpen && item.children && (
        <div style={{ borderLeft: `1px solid ${colors.borderSubtle}`, marginLeft: 10 }}>
          {item.children.map((child) => (
            <TreeItem
              key={child.path}
              item={child}
              onFileSelect={onFileSelect}
              useDoubleClick={useDoubleClick}
              themeColor={themeColor}
              allFiles={allFiles}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const DirectoryTree: React.FC<DirectoryTreeProps> = ({
  items,
  onFileSelect,
  useDoubleClick,
  themeColor,
  onContextMenu,
}) => {
  const [sortCol, setSortCol] = useState<SortColumn>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const allMediaFiles = useMemo(() => {
    const extractFiles = (items: FileItem[]): FileItem[] => {
      let files: FileItem[] = [];
      items.forEach((item) => {
        if (item.isDirectory && item.children) {
          files = files.concat(extractFiles(item.children));
        } else if (item.isMedia) {
          files.push(item);
        }
      });
      return files;
    };
    return extractFiles(items);
  }, [items]);

  const sortedItems = useMemo(() => {
    const sortFn = (a: FileItem, b: FileItem) => {
      // Directories always come first
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      if (a.isDirectory && b.isDirectory) return a.name.localeCompare(b.name);

      const text = (item: FileItem): string => {
        switch (sortCol) {
          case "title":
            return item.metadata?.title || item.name;
          case "artist":
            return item.metadata?.artists?.[0] || "";
          case "album":
            return item.metadata?.album || "";
          default:
            return item.name;
        }
      };
      const res =
        sortCol === "duration"
          ? (a.metadata?.duration || 0) - (b.metadata?.duration || 0)
          : text(a).localeCompare(text(b));

      return sortOrder === "asc" ? res : -res;
    };

    return [...items].sort(sortFn);
  }, [items, sortCol, sortOrder]);

  const toggleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortOrder("asc");
    }
  };

  const HeaderCol = ({
    label,
    col,
    width,
    flex,
  }: {
    label: string;
    col: SortColumn;
    width?: string;
    flex?: number;
  }) => (
    <div
      onClick={() => toggleSort(col)}
      style={{
        width,
        flex,
        display: "flex",
        alignItems: "center",
        gap: "4px",
        cursor: "pointer",
        color: sortCol === col ? themeColor : colors.textDim,
        fontSize: "12px",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {label}
      {sortCol === col && (sortOrder === "asc" ? <IoCaretUp /> : <IoCaretDown />)}
    </div>
  );

  return (
    <div style={{ backgroundColor: "transparent" }}>
      {/* Table Header */}
      <div
        style={{
          display: "flex",
          padding: "10px 18px",
          borderBottom: `1px solid ${colors.borderSubtle}`,
          backgroundColor: colors.bgSurface,
          position: "sticky",
          top: 0,
          zIndex: 10,
          gap: "12px",
        }}
      >
        <HeaderCol label="Name" col="name" width="300px" />
        <HeaderCol label="Title" col="title" flex={1} />
        <HeaderCol label="Artist" col="artist" flex={1} />
        <HeaderCol label="Album" col="album" flex={1} />
        <HeaderCol label="Duration" col="duration" width="60px" />
      </div>

      <div style={{ padding: "0" }}>
        {sortedItems.map((item) => (
          <TreeItem
            key={item.path}
            item={item}
            onFileSelect={onFileSelect}
            useDoubleClick={useDoubleClick}
            isRoot={true}
            themeColor={themeColor}
            allFiles={allMediaFiles}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
    </div>
  );
};
