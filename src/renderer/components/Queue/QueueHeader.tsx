import { formatDuration } from "../../../utils/time";

type QueueHeaderProps = {
    totalSongs: number;
    totalDuration: number;
    onClear: () => void;
    scrollToCurrent: () => void;
};

export function QueueHeader({
    totalSongs,
    totalDuration,
    onClear,
    scrollToCurrent
}: QueueHeaderProps) {
    const minutes = Math.floor(totalDuration / 60);
    const seconds = Math.floor(totalDuration % 60)
        .toString()
        .padStart(2, "0");

    return (
        <div
            style={{
                padding: "20px 30px",
                borderBottom: "1px solid #222",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#181818",
            }}
        >
            <h2 style={{ margin: 0 }}>
                Play Queue ({totalSongs} songs: {formatDuration(totalDuration)})
            </h2>
            <div>
                <button
                    onClick={scrollToCurrent}
                    style={{
                        marginRight: "10px",
                        background: "#222",
                        border: "1px solid #333",
                        color: "#fff",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "12px",
                    }}
                >
                    Go to current
                </button>
                <button
                    onClick={onClear}
                    style={{
                        background: "none",
                        border: "1px solid #444",
                        color: "#888",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                    }}
                >
                    Clear Queue
                </button>
            </div>
        </div>
    );
}