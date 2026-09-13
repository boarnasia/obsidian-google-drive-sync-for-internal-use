/** 同期エンジンから見たローカルのファイル（変更検知のため内容をハッシュ化してある）。 */
export interface LocalFile {
  path: string;
  hash: string;
  mtime: number;
}

/** 1 パス分のベースライン。キーが無いことが「まだ同期していない」を意味する。 */
export interface FileState {
  localHash: string;
  remoteVersion: string;
}

export type SyncStateData = Record<string, FileState>;

/** 1 回の同期が何をしたか。通知とテストのために使う。 */
export interface SyncReport {
  uploaded: string[];
  downloaded: string[];
  deletedLocal: string[];
  deletedRemote: string[];
  /**
   * 安全上限を超えたため実行せずに持ち越した削除。ベースラインは更新していないので、
   * 次の同期でもう一度同じ判断に到達する（ADR-0001）。
   */
  deferredDeletes: string[];
  conflicts: { path: string; conflictPath: string }[];
  errors: { path: string; error: string }[];
}

export function emptyReport(): SyncReport {
  return {
    uploaded: [],
    downloaded: [],
    deletedLocal: [],
    deletedRemote: [],
    deferredDeletes: [],
    conflicts: [],
    errors: [],
  };
}
