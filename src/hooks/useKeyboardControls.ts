import { useEffect, useRef } from "react";

type Params = {
    togglePlay: () => void;
    handleNext: () => void;
    handlePrevious: () => void;
    seekForward: () => void;
    seekBackward: () => void;
    goBack?: () => void;
};

export function useKeyboardControls({
    togglePlay,
    handleNext,
    handlePrevious,
    seekForward,
    seekBackward,
    goBack,
}: Params) {
    // Stable ref so the event listeners never need to re-register when goBack changes
    const goBackRef = useRef(goBack);
    useEffect(() => { goBackRef.current = goBack; });

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;

            const isTyping =
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable;

            if (isTyping) return;

            switch (event.code) {
                case "Escape":
                    goBackRef.current?.();
                    break;

                case "Space":
                    event.preventDefault();
                    togglePlay();
                    break;

                case "PageDown":
                case "MediaTrackNext":
                    event.preventDefault();
                    handleNext();
                    break;

                case "PageUp":
                case "MediaTrackPrevious":
                    event.preventDefault();
                    handlePrevious();
                    break;

                case "ArrowRight":
                    event.preventDefault();
                    seekForward();
                    break;

                case "ArrowLeft":
                    event.preventDefault();
                    seekBackward();
                    break;

                case "ArrowUp":
                case "ArrowDown": {
                    const isScrollable =
                        target.scrollHeight > target.clientHeight;

                    if (!isScrollable) return;

                    event.preventDefault();

                    const scrollAmount = 40;

                    target.scrollTop +=
                        event.code === "ArrowDown"
                            ? scrollAmount
                            : -scrollAmount;

                    break;
                }
            }
        };

        const handleMouseUp = (event: MouseEvent) => {
            // Mouse button 3 = side "back" button on most mice
            if (event.button === 3) {
                event.preventDefault();
                goBackRef.current?.();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [
        togglePlay,
        handleNext,
        handlePrevious,
        seekForward,
        seekBackward,
    ]);
}