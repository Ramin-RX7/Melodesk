import React, { useState } from "react";
import { FileItem } from "../types";
import {
  IoFolder,
  IoFolderOpen,
  IoMusicalNote,
  IoChevronForward,
  IoChevronDown
} from "react-icons/io5";

interface DirectoryTreeProps {
  items: FileItem[];
  onFileSelect: (item: FileItem) => void;
  useDoubleClick: boolean;
}

const TreeItem: React.FC<{
  item: FileItem;
  onFileSelect: (item: FileItem) => void;
  useDoubleClick: boolean;
}> = ({ item, onFileSelect, useDoubleClick }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {
    if (item.isDirectory) {
      setIsOpen(!isOpen);
    } else if (item.isMedia && !useDoubleClick) {
      onFileSelect(item);
    }
  };

  const handleDoubleClick = () => {
    if (item.isMedia && useDoubleClick) {
      onFileSelect(item);
    }
  };

  return (
    <div style={{ marginLeft: 15, cursor: "pointer", color: "#e0e0e0" }}>
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{
          padding: "4px 8px",
          borderRadius: "4px",
          backgroundColor: "transparent",
          transition: "background-color 0.2s",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          opacity: item.isDirectory || item.isMedia ? 1 : 0.5,
          userSelect: "none"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#333")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <span style={{ display: "flex", alignItems: "center", color: item.isDirectory ? "#1db954" : "#888" }}>
          {item.isDirectory ? (isOpen ? <IoFolderOpen /> : <IoFolder />) : <IoMusicalNote />}
        </span>
        <span style={{ fontWeight: item.isMedia ? "bold" : "normal", fontSize: "14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.name}
        </span>
      </div>
      {item.isDirectory && isOpen && item.children && (
        <div style={{ borderLeft: "1px solid #444", marginLeft: 8 }}>
          {item.children.map((child) => (
            <TreeItem
              key={child.path}
              item={child}
              onFileSelect={onFileSelect}
              useDoubleClick={useDoubleClick}
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
}) => {
  return (
    <div
      style={{
        padding: "0",
        flex: 1,
        overflowY: "auto",
        backgroundColor: "transparent",
      }}
    >
      <div style={{ padding: "10px" }}>
        {items.map((item) => (
          <TreeItem
            key={item.path}
            item={item}
            onFileSelect={onFileSelect}
            useDoubleClick={useDoubleClick}
          />
        ))}
      </div>
    </div>
  );
};
