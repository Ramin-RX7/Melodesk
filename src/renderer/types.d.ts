export {};

declare global {
  interface Window {
    api: {
      selectDirectory: () => Promise<{ name: string; path: string }[]>;
    };
  }
}
