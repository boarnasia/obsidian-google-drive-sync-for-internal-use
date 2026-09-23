/** A remote object the provider can store. `path` is sync-root-relative (POSIX). */
export interface RemoteObject {
  path: string;
  /** Opaque version (Drive `md5Checksum`) for change detection. */
  version: string;
  size: number;
  /**
   * Last-modified time in epoch ms — the remote's own upload/modify time
   * (Drive `modifiedTime`). Used ONLY to pick the newer
   * side in a modify/modify conflict; never for change detection. Optional:
   * absent ⇒ treated as the oldest possible time (the other side wins).
   */
  mtime?: number;
}

export interface PutResult {
  version: string;
}

/** Minimal HTTP response shape (adapted from Obsidian `requestUrl` / Node fetch). */
export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

/**
 * The transport gave up waiting for a response. Whether the request reached the
 * server is unknown, and the wait already hit the ceiling, so it is not retried.
 */
export class RequestTimeoutError extends Error {
  override name = "RequestTimeoutError";
}

/**
 * Transport seam (DIP). The plugin wires Obsidian's `requestUrl`, which is not
 * subject to CORS as browser `fetch` is; tests wire in-memory fakes.
 */
export type HttpSend = (
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: ArrayBuffer
) => Promise<HttpResponse>;

/**
 * Backend-agnostic contract the sync engine depends on.
 * Implementations MUST NOT log credentials, signing keys, or Authorization headers.
 */
export interface RemoteProvider {
  readonly id: string;
  /** Upload bytes at a sync-root-relative path. */
  put(path: string, data: ArrayBuffer, contentType?: string): Promise<PutResult>;
  /** Download bytes; `null` if the object does not exist. */
  get(path: string): Promise<ArrayBuffer | null>;
  /** Metadata only; `null` if absent. */
  head(path: string): Promise<RemoteObject | null>;
  /** Delete an object (idempotent — missing is success). */
  delete(path: string): Promise<void>;
  /**
   * List objects under an optional prefix (handles pagination internally).
   * `onFound` receives the running count of files found so far; the total is not known up front.
   */
  list(prefix?: string, onFound?: (found: number) => void): Promise<RemoteObject[]>;
}
