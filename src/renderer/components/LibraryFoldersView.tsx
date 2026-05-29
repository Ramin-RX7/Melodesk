// LibraryFoldersView.tsx

import { IoFolder, IoClose } from "react-icons/io5";

export function LibraryFoldersView({
    config,
    themeColor,
    handleAddFolder,
    handleRefreshLibrary,
    setSelectedLibraryPath,
    handleRemoveFolder,
}: any) {
    return (
        <div style={{ padding: "30px", overflowY: "auto", height: "100%", paddingBottom: "120px" }}>

            <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "30px"
            }}>
                <h2 style={{ margin: 0 }}>Library Folders</h2>

                <div style={{ display: "flex", gap: "10px" }}>
                    <button
                        onClick={handleRefreshLibrary}
                        style={{
                            backgroundColor: "#333",
                            color: "#fff",
                            border: "none",
                            padding: "10px 20px",
                            borderRadius: "20px",
                            fontWeight: "bold",
                            cursor: "pointer"
                        }}
                    >
                        Refresh Library
                    </button>

                    <button
                        onClick={handleAddFolder}
                        style={{
                            backgroundColor: themeColor,
                            color: "#fff",
                            border: "none",
                            padding: "10px 20px",
                            borderRadius: "20px",
                            fontWeight: "bold",
                            cursor: "pointer"
                        }}
                    >
                        Add Folder
                    </button>
                </div>
            </div>

            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                gap: "20px"
            }}>
                {config?.libraryPaths.map((path: string) => (
                    <div
                        key={path}
                        onClick={() => setSelectedLibraryPath(path)}
                        style={{
                            backgroundColor: "#1e1e1e",
                            padding: "20px",
                            borderRadius: "10px",
                            cursor: "pointer",
                            position: "relative",
                            border: "1px solid #333"
                        }}
                    >
                        <div style={{ fontSize: "40px", marginBottom: "10px", color: themeColor }}>
                            <IoFolder />
                        </div>

                        <div style={{
                            fontWeight: "bold",
                            marginBottom: "5px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                        }}>
                            {path.split(/[\\/]/).pop()}
                        </div>

                        <div style={{
                            fontSize: "12px",
                            color: "#888",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                        }}>
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
                                color: "#666",
                                cursor: "pointer"
                            }}
                        >
                            <IoClose />
                        </button>
                    </div>
                ))}

                {(!config || config.libraryPaths.length === 0) && (
                    <div style={{
                        gridColumn: "1 / -1",
                        textAlign: "center",
                        padding: "50px",
                        color: "#666"
                    }}>
                        No folders added to library. Click "Add Folder" to start.
                    </div>
                )}
            </div>
        </div>
    );
}