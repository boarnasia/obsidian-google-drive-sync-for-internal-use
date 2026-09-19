import { LangPref } from "./i18n";
import { SyncStateData } from "./sync/types";

/** 解決済みの同期先。driveId の有無で変更ログの読み先も決まる（ADR-0002）。 */
export interface DriveTarget {
  folderId: string;
  folderName: string;
  /** "" ならマイドライブ。 */
  driveId: string;
  driveName: string;
  /** ドライブの最上位から同期先フォルダまでの名前。表示専用で、古い保存データには無い。 */
  path?: string[];
}

export interface Settings {
  /** "auto" は Obsidian の表示言語に従う。 */
  language: LangPref;

  // --- Google OAuth クライアント ---
  oauthClientId: string;
  oauthClientSecret: string;
  /** 平文保存だが data.json は同期対象外（ADR-0003）。 */
  driveToken: string | null;

  // --- 同期先 ---
  /** 入力欄に出し直すためだけに持つ。 */
  targetUrl: string;
  target: DriveTarget | null;
  /** "" なら Vault 全体。直下が同期ルート直下に対応する（ADR-0004）。 */
  mountFolder: string;

  // --- 同期の挙動 ---
  autoSync: boolean;
  pollMinutes: number;
  /** epoch ms。null は未同期。 */
  lastSyncAt: number | null;

  // --- 同期ルート単位の状態（キーは folderId） ---
  /** 別ルートに古いベースラインを当てると全削除と解釈されるため folderId で分ける（ADR-0004）。 */
  syncState: Record<string, SyncStateData>;
  /** 失っても「変更あり」扱いで正しさは保たれる。 */
  changeToken: Record<string, string>;
}

export const DEFAULT_SETTINGS: Settings = {
  language: "auto",

  oauthClientId: "",
  oauthClientSecret: "",
  driveToken: null,

  targetUrl: "",
  target: null,
  mountFolder: "",

  autoSync: true,
  pollMinutes: 1,
  lastSyncAt: null,

  syncState: {},
  changeToken: {},
};
