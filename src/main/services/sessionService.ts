import { app } from "electron";
import fs from "fs";
import path from "path";

import { SessionData } from "../../renderer/types";


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

export const saveSession = (data: SessionData): void => {
    try {
        fs.writeFileSync(SESSION_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Failed to save session:", error);
    }
};

export const clearSession = (): void => {
    try {
        if (fs.existsSync(SESSION_PATH)) {
            fs.unlinkSync(SESSION_PATH);
        }
    } catch (error) {
        console.error("Failed to clear session:", error);
    }
};
