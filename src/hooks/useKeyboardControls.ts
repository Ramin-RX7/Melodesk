import { useEffect } from "react";

type Params = {
    togglePlay: () => void;
    handleNext: () => void;
    handlePrevious: () => void;
    seekForward: () => void;
    seekBackward: () => void;
};

export function useKeyboardControls({
    togglePlay,
    handleNext,
    handlePrevious,
    seekForward,
    seekBackward,
}: Params) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;

            const isTyping =
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable;

            if (isTyping) return;

            switch (event.code) {
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

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [
        togglePlay,
        handleNext,
        handlePrevious,
        seekForward,
        seekBackward,
    ]);
}