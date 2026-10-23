import { formatDuration } from "../../../utils/time";
import { colors } from "../../theme/colors";

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
  scrollToCurrent,
}: QueueHeaderProps) {
  return (
    <div
      style={{
        padding: "20px 30px",
        borderBottom: `1px solid ${colors.borderFaint}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: colors.bgSurface,
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
            background: colors.bgControl,
            border: `1px solid ${colors.borderSubtle}`,
            color: colors.textPrimary,
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
            border: `1px solid ${colors.border}`,
            color: colors.textDim,
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
