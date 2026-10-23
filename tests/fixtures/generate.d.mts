export const GENERATED_DIR: string;
export const LIBRARY_DIR: string;

export type FixtureSong = {
  folder: string;
  file: string;
  seconds: number;
  tags: Record<string, string> | null;
  cover: Buffer | null;
  wav?: boolean;
};

export const SONGS: FixtureSong[];
export function silentMp3(seconds: number): Buffer;
export function silentWav(seconds: number): Buffer;
export function solidPng(rgb: [number, number, number], size?: number): Buffer;
export function writeLibrary(root: string): void;
export function ensureLibrary(): string;
export function copyLibrary(target: string): string;
