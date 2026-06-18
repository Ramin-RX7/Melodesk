// LibraryFoldersView.tsx

import { IoFolder, IoClose } from "react-icons/io5";

export function LibraryFoldersView({
    config,
    themeColor,
    handleAddFolder,
    handleRefreshLibrary,
    setSelectedLibraryPath,
    handleRemoveFolder,
    setConfig,
}: any) {
    const handleToggleRestoreSession = async () => {
        const newConfig = await window.api.updateConfig({ restoreSession: !config?.restoreSession });
        setConfig(newConfig);
    };
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

            {/* <div style={{ marginTop: "40px" }}>
                <h3 style={{ margin: "0 0 16px 0", color: "#aaa", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Settings</h3>
                <div
                    onClick={handleToggleRestoreSession}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#1e1e1e",
                        padding: "14px 18px",
                        borderRadius: "10px",
                        border: "1px solid #333",
                        cursor: "pointer",
                        maxWidth: "420px",
                    }}
                >
                    <div>
                        <div style={{ fontWeight: 500, marginBottom: "3px" }}>Restore session on startup</div>
                        <div style={{ fontSize: "12px", color: "#666" }}>Resume the last playing track and queue when the app starts</div>
                    </div>
                    <div style={{
                        width: "38px", height: "22px", borderRadius: "11px",
                        backgroundColor: config?.restoreSession ? themeColor : "#444",
                        position: "relative", flexShrink: 0, marginLeft: "16px",
                        transition: "background-color 0.2s",
                    }}>
                        <div style={{
                            position: "absolute", top: "3px",
                            left: config?.restoreSession ? "19px" : "3px",
                            width: "16px", height: "16px", borderRadius: "50%",
                            backgroundColor: "#fff",
                            transition: "left 0.2s",
                        }} />
                    </div>
                </div>
            </div> */}
        </div>
    );
}