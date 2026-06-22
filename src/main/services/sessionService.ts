import { app } from "electron";
import fs from "fs";
import path from "path";

import { SessionData, WindowBounds } from "../../renderer/types";


const SESSION_PATH = path.join(app.getPath("userData"), "session.json");

export const getSession = (): SessionData | null => {
    try {
        if (fs.existsSync(SESSION_PATH)) {
            return JSON.parse(fs.readFileSync(SESSION_PATH, "utf-8")) as SessionData;
        }
    } catch (error) {
        console.error("Failed to read session:", error);
    }
    return null;
};

const writeSession = (data: Partial<SessionData>): void => {
    try {
        fs.writeFileSync(SESSION_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Failed to save session:", error);
    }
};

export const saveSession = (data: Partial<SessionData>): void => {
    // Merge so playback state and window bounds (written separately) don't clobber each other.
    const existing = getSession();
    writeSession({ ...existing, ...data });
};

export const clearSession = (): void => {
    // Only clear playback state; window bounds persist independently of the restore-session setting.
    const existing = getSession();
    if (existing?.windowBounds || existing?.miniWindowBounds) {
        writeSession({
            windowBounds: existing.windowBounds,
            miniWindowBounds: existing.miniWindowBounds,
        });
    } else if (fs.existsSync(SESSION_PATH)) {
        try {
            fs.unlinkSync(SESSION_PATH);
        } catch (error) {
            console.error("Failed to clear session:", error);
        }
    }
};

export const getWindowBounds = (): WindowBounds | null => {
    return getSession()?.windowBounds ?? null;
};

export const saveWindowBounds = (bounds: WindowBounds): void => {
    saveSession({ windowBounds: bounds });
};

export const getMiniWindowBounds = (): WindowBounds | null => {
    return getSession()?.miniWindowBounds ?? null;
};

export const saveMiniWindowBounds = (bounds: WindowBounds): void => {
    saveSession({ miniWindowBounds: bounds });
};
