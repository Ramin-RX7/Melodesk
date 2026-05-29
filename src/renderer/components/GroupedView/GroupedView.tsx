import React, { useState, useEffect } from "react";
import {
    IoSearch,
    IoSwapVertical,
    IoShuffle,
    IoCreate,
    IoSave,
    IoImage
} from "react-icons/io5";

import { FileItem, UserConfig, ArtistInfo } from "../../types";

import styles from "./GroupedView.module.css";

import { GroupList } from "./GroupList";
import { SongGrid } from "./SongGrid";

import {
    getFilteredSongs,
    getGroupEntries
} from "./groupedView.utils";

import {
    GroupSortBy,
    GroupType,
    SelectedGroup
} from "./types";

type Props = {
    type: GroupType;
    allTracks: FileItem[];

    selectedGroup: SelectedGroup | null;

    searchQuery: string;
    sortBy: GroupSortBy;
    sortDescending: boolean;

    currentTrack?: FileItem | null;

    config: UserConfig | null;

    themeColor: string;

    setSelectedGroup: (
        group: SelectedGroup | null
    ) => void;

    setSearchQuery: (
        query: string
    ) => void;

    setSortBy: (
        sortBy: GroupSortBy
    ) => void;

    setSortDescending: (
        value: boolean
    ) => void;

    normalizeGenre: (
        genre: string
    ) => string;

    handleFileSelect: (
        song: FileItem,
        queue?: FileItem[]
    ) => void;

    handleShufflePlay?: (songs: FileItem[]) => void;
};

export function GroupedView({
    type,
    allTracks,

    selectedGroup,

    searchQuery,
    sortBy,
    sortDescending,

    currentTrack,

    config,

    themeColor,

    setSelectedGroup,
    setSearchQuery,
    setSortBy,
    setSortDescending,

    normalizeGenre,

    handleFileSelect,
    handleShufflePlay
}: Props) {
    const [artistInfo, setArtistInfo] = useState<ArtistInfo | null>(null);
    const [isEditingArtist, setIsEditingArtist] = useState(false);
    const [editBio, setEditBio] = useState("");
    
    useEffect(() => {
        if (type === 'artist' && selectedGroup) {
            window.api.getArtistInfo(selectedGroup.name).then(info => {
                setArtistInfo(info);
                if (info) setEditBio(info.bio || "");
            }).catch(console.error);
        } else {
            setArtistInfo(null);
        }
    }, [type, selectedGroup]);

    const handleSaveArtist = async () => {
        if (!selectedGroup) return;
        try {
            const updated = await window.api.updateArtistInfo(selectedGroup.name, { bio: editBio });
            setArtistInfo(updated);
            setIsEditingArtist(false);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectImage = async () => {
        if (!selectedGroup) return;
        try {
            const path = await window.api.selectArtistImage();
            if (path) {
                const updated = await window.api.updateArtistInfo(selectedGroup.name, { picture: path });
                setArtistInfo(updated);
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (selectedGroup) {
        const songs = getFilteredSongs(
            allTracks,
            selectedGroup.name,
            type,
            searchQuery,
            sortDescending
        );

        return (
            <div className={styles.container}>

                {/* HEADER */}
                <div className={styles.header}>

                    <div className={styles.headerLeft}>
                        <button
                            className={styles.backButton}
                            onClick={() => {
                                setSelectedGroup(null);
                                setSearchQuery("");
                            }}
                        >
                            Back to {type}s
                        </button>

                        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                            <h2 className={styles.title} style={{ margin: 0 }}>
                                {selectedGroup.name}
                            </h2>
                            {handleShufflePlay && (
                                <button onClick={() => handleShufflePlay(songs)} style={{ display: "flex", alignItems: "center", gap: "5px", backgroundColor: themeColor, color: "#fff", border: "none", padding: "6px 12px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}>
                                    <IoShuffle /> Shuffle Play
                                </button>
                            )}
                        </div>
                    </div>

                    {/* SEARCH */}
                    <div className={styles.searchContainer}>
                        <IoSearch className={styles.searchIcon} />

                        <input
                            type="text"
                            placeholder={`Search in ${selectedGroup.name}...`}
                            value={searchQuery}
                            onChange={(e) =>
                                setSearchQuery(e.target.value)
                            }
                            className={styles.searchInput}
                        />
                    </div>
                </div>

                {/* SCROLLABLE CONTENT */}
                <div className={styles.scrollArea}>
                    
                    {/* ARTIST PROFILE */}
                    {type === 'artist' && artistInfo && (
                        <div style={{ display: "flex", gap: "30px", padding: "20px", backgroundColor: "#1e1e1e", borderRadius: "12px", marginBottom: "20px", border: "1px solid #333" }}>
                            <div style={{ width: "200px", height: "200px", borderRadius: "10px", backgroundColor: "#111", overflow: "hidden", position: "relative", flexShrink: 0 }}>
                                {artistInfo.picture ? (
                                    <img src={`media://${encodeURIComponent(artistInfo.picture.replace(/\\/g, "/"))}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: "60px" }}><IoImage /></div>
                                )}
                                <button onClick={handleSelectImage} style={{ position: "absolute", bottom: "10px", right: "10px", backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", border: "1px solid #555", borderRadius: "5px", padding: "5px 10px", cursor: "pointer", fontSize: "12px" }}>Change Photo</button>
                            </div>
                            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                    <h3 style={{ margin: 0, fontSize: "24px" }}>About</h3>
                                    {!isEditingArtist ? (
                                        <button onClick={() => setIsEditingArtist(true)} style={{ background: "none", border: "1px solid #555", color: "#ccc", borderRadius: "15px", padding: "4px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                                            <IoCreate /> Edit Bio
                                        </button>
                                    ) : (
                                        <div style={{ display: "flex", gap: "10px" }}>
                                            <button onClick={() => setIsEditingArtist(false)} style={{ background: "none", border: "1px solid #555", color: "#ccc", borderRadius: "15px", padding: "4px 12px", cursor: "pointer" }}>Cancel</button>
                                            <button onClick={handleSaveArtist} style={{ backgroundColor: themeColor, border: "none", color: "#fff", borderRadius: "15px", padding: "4px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                                                <IoSave /> Save
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {isEditingArtist ? (
                                    <textarea value={editBio} onChange={e => setEditBio(e.target.value)} style={{ flex: 1, width: "100%", backgroundColor: "#111", color: "#ddd", border: "1px solid #444", borderRadius: "8px", padding: "10px", resize: "none", fontFamily: "inherit" }} placeholder="Write a biography for this artist..." />
                                ) : (
                                    <div style={{ flex: 1, color: "#aaa", lineHeight: "1.5", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                                        {artistInfo.bio || "No biography available. Click 'Edit Bio' to add one."}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <SongGrid
                        songs={songs}
                        selectedGroup={selectedGroup.name}
                        type={type}
                        currentTrack={currentTrack}
                        config={config}
                        themeColor={themeColor}
                        onBack={() => { }}
                        onSongClick={(song) =>
                            handleFileSelect(song, songs)
                        }
                    />
                </div>
            </div>
        );
    }

    const entries = getGroupEntries(
        allTracks,
        type,
        searchQuery,
        sortBy,
        sortDescending,
        normalizeGenre,
        config
    );

    return (
        <div className={styles.container}>

            {/* HEADER */}
            <div className={styles.header}>

                <h2 className={styles.title}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}s
                </h2>

                <div className={styles.headerControls}>

                    {/* SORT */}
                    <div className={styles.sortControls}>

                        <span className={styles.sortLabel}>
                            Sort by:
                        </span>

                        <select
                            value={sortBy}
                            onChange={(e) =>
                                setSortBy(
                                    e.target.value as GroupSortBy
                                )
                            }
                            className={styles.sortSelect}
                        >
                            <option value="alphabet">
                                Alphabet
                            </option>

                            <option value="count">
                                Song Count
                            </option>
                        </select>

                        <button
                            onClick={() =>
                                setSortDescending(
                                    !sortDescending
                                )
                            }
                            className={styles.sortButton}
                            style={{
                                color:
                                    sortDescending
                                        ? themeColor
                                        : "#888"
                            }}
                        >
                            <IoSwapVertical />
                        </button>
                    </div>

                    {/* SEARCH */}
                    <div className={styles.searchContainer}>

                        <IoSearch className={styles.searchIcon} />

                        <input
                            type="text"
                            placeholder={`Search ${type}s...`}
                            value={searchQuery}
                            onChange={(e) =>
                                setSearchQuery(e.target.value)
                            }
                            className={styles.searchInput}
                        />
                    </div>
                </div>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className={styles.scrollArea}>

                <GroupList
                    entries={entries}
                    type={type}
                    allTracks={allTracks}
                    onSelect={(name) => {
                        setSelectedGroup({
                            type,
                            name
                        });

                        setSearchQuery("");
                    }}
                />

                {entries.length === 0 && (
                    <div className={styles.emptyState}>
                        {searchQuery
                            ? `No results for "${searchQuery}"`
                            : `No ${type}s found in your library.`}
                    </div>
                )}
            </div>
        </div>
    );
}