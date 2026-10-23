// Loads an ESM-only package (chokidar, music-metadata, node-id3) from the CommonJS main process.
// A plain import() would be rewritten into require() by tsc; eval keeps it a real import().
// Tests replace this module with a plain import() (tests/helpers/main-setup.ts).
export const importEsm = <T>(name: string): Promise<T> => eval(`import(${JSON.stringify(name)})`);
