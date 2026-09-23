/** 同期エンジンから見たローカルのファイル（変更検知のため内容をハッシュ化してある）。 */
export interface LocalFile {
  path: string;
  hash: string;
  mtime: number;
  size: number;
}

/**
 * 前回ハッシュしたときのファイルの姿。mtime と size が当時のままなら中身も同じと
 * みなし、読み直さない。ベースラインに載せて再起動をまたいで持ち越す。
 */
export interface LocalStamp {
  hash: string;
  mtime: number;
  size: number;
}

/** 書き込んだ直後のファイルの姿。ハッシュは書いた側が知っている。 */
export type LocalStat = Pick<LocalStamp, "mtime" | "size">;

/** 1 パス分のベースライン。キーが無いことが「まだ同期していない」を意味する。 */
export interface FileState {
  localHash: string;
  remoteVersion: string;
  /** ハッシュを計算したときの姿。無ければ次の同期で読み直す（古い保存データ、ダウンロード直後）。 */
  localMtime?: number;
  localSize?: number;
}

export type SyncStateData = Record<string, FileState>;

/**
 * ベースラインが現実と合っていない疑いの理由。1 つでもあればアップロードを止める
 * （ダウンロードは続ける）。抜けるには clone でやり直すか、保留削除を承認する（ADR-0005）。
 */
export type BlockReason =
  /** ベースラインが無いのに、ローカルとリモートの両方に中身がある。 */
  | "no-baseline"
  /** ローカルが空で、ベースラインが空でない。Vault を消した直後がこれ。 */
  | "vault-empty"
  /** 消すことになる数が安全上限を超えた。 */
  | "delete-guard";

/** 適用せずに「この同期が何をするか」を数えたもの。サイドバーの表示にも使う。 */
export interface SyncPlan {
  upload: string[];
  download: string[];
  conflict: string[];
  deleteLocal: string[];
  deleteRemote: string[];
  /** リモートに無いローカルのファイル。分類の対象（ADR-0006）。 */
  localOnly: string[];
  /** そのうち未整理のもの。1 件でもあれば新規アップロードを止める。 */
  unsorted: string[];
  blocked: BlockReason[];
  /** 削除の安全上限。保留された削除を見せるときに使う。 */
  deleteLimit: number;
}

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
  /** アップロードを止めた理由。空なら止めていない。 */
  blocked: BlockReason[];
  /** 止まっていたためアップロードしなかったパス。 */
  heldUploads: string[];
  /** リモートに無いローカルのファイル（clone の後に分類する）。 */
  localOnly: string[];
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
    blocked: [],
    heldUploads: [],
    localOnly: [],
  };
}

/**
 * clone の進み具合。長い処理が止まって見えないよう、サイドバーとステータスバーに出す。
 *
 * - `scan`: 両側の一覧。Drive の件数は辿り終えるまで総数が分からない。
 * - `download`: 総量が分かる。割合はバイト数で出す（件数だと大きな添付で止まって見える）。
 * - `finish`: ベースラインの保存。
 */
export type CloneProgress =
  | { phase: "scan"; remoteFound: number; localDone: number; localTotal: number }
  | {
      phase: "download";
      done: number;
      total: number;
      bytesDone: number;
      bytesTotal: number;
      failed: number;
      /** 最後に扱い終えたパス。 */
      current: string;
    }
  | { phase: "finish" };

export interface CloneOptions {
  onProgress?: (p: CloneProgress) => void;
  /** 中止。ベースラインは書かない。すでに降りたファイルは残る。 */
  signal?: AbortSignal;
}
