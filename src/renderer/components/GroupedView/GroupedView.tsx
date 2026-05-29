import {
    IoSearch,
    IoSwapVertical
} from "react-icons/io5";

import { FileItem, UserConfig } from "../../types";

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

    handleFileSelect
}: Props) {

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

                        <h2 className={styles.title}>
                            {selectedGroup.name}
                        </h2>
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