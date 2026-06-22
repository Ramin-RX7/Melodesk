import React from "react";
import {
  IoRemove,
  IoSquareOutline,
  IoCopyOutline,
  IoClose,
  IoContract,
} from "react-icons/io5";
import { colors } from "../../theme/colors";

interface TitleBarProps {
  onEnterMini: () => void;
  themeColor: string;
}

// Custom window chrome. The app runs frameless (see main.ts `frame: false`), so
// this bar provides the OS drag region and the window-control buttons.
export const TitleBar: React.FC<TitleBarProps> = ({ onEnterMini, themeColor }) => {
  const [isMaximized, setIsMaximized] = React.useState(false);

  React.useEffect(() => {
    window.api.isMaximized().then(setIsMaximized);
    return window.api.onMaximizedChanged(setIsMaximized);
  }, []);

  const dragStyle = { WebkitAppRegion: "drag" } as React.CSSProperties;
  const noDragStyle = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

  const btn: React.CSSProperties = {
    ...noDragStyle,
    background: "none",
    border: "none",
    color: colors.textMuted,
    width: "44px",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    cursor: "pointer",
    transition: "background-color 0.15s, color 0.15s",
  };

  const hover = (e: React.MouseEvent, bg: string, color: string) => {
    const el = e.currentTarget as HTMLElement;
    el.style.backgroundColor = bg;
    el.style.color = color;
  };
  const reset = (e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.backgroundColor = "transparent";
    el.style.color = colors.textMuted;
  };

  return (
    <div
      style={{
        ...dragStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "32px",
        flexShrink: 0,
        backgroundColor: colors.bgBlack,
        borderBottom: `1px solid ${colors.borderSubtle}`,
        userSelect: "none",
        color: colors.textPrimary,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingLeft: "12px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600, color: colors.textBright }}>MeloDesk</span>
      </div>

      <div style={{ display: "flex", alignItems: "stretch", height: "100%" }}>
        <button
          style={btn}
          title="Mini player"
          onClick={onEnterMini}
          onMouseEnter={(e) => hover(e, colors.bgHover, themeColor)}
          onMouseLeave={reset}
        >
          <IoContract />
        </button>
        <button
          style={btn}
          title="Minimize"
          onClick={() => window.api.minimizeWindow()}
          onMouseEnter={(e) => hover(e, colors.bgHover, colors.textPrimary)}
          onMouseLeave={reset}
        >
          <IoRemove />
        </button>
        <button
          style={btn}
          title={isMaximized ? "Restore" : "Maximize"}
          onClick={() => window.api.maximizeWindow()}
          onMouseEnter={(e) => hover(e, colors.bgHover, colors.textPrimary)}
          onMouseLeave={reset}
        >
          {isMaximized ? <IoCopyOutline style={{ fontSize: "13px" }} /> : <IoSquareOutline style={{ fontSize: "13px" }} />}
        </button>
        <button
          style={btn}
          title="Close"
          onClick={() => window.api.closeWindow()}
          onMouseEnter={(e) => hover(e, colors.danger, colors.textPrimary)}
          onMouseLeave={reset}
        >
          <IoClose />
        </button>
      </div>
    </div>
  );
};
