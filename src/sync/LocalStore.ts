import { LocalFile, LocalStamp, LocalStat } from "./types";

/**
 * The local side of a sync (a vault, or a chosen subfolder). The Obsidian
 * implementation wraps the Vault/DataAdapter API; tests use an in-memory fake.
 * Implementations apply `normalizePath()` and stay within the sync scope.
 */
export interface LocalStore {
  /**
   * All files in scope, with content hashes. Excludes the plugin's own config.
   *
   * `known` carries the stamp (hash + mtime + size) of the last time each path was
   * hashed. A file whose mtime and size are unchanged keeps that hash and is not
   * read — otherwise every sync would read the whole vault to learn nothing.
   */
  list(known?: ReadonlyMap<string, LocalStamp>): Promise<LocalFile[]>;
  read(path: string): Promise<ArrayBuffer>;
  /** Text of a file that may not exist; `null` when it does not. Used for the config files. */
  readText(path: string): Promise<string | null>;
  /**
   * Returns the file's mtime and size after the write, so the baseline can carry a
   * stamp for downloaded files and the next listing does not have to read them back.
   */
  write(path: string, data: ArrayBuffer): Promise<LocalStat>;
  delete(path: string): Promise<void>;
}
