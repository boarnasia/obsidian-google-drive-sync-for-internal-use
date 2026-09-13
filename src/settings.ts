import { LangPref } from "./i18n";
import { SyncStateData } from "./sync/types";

/**
 * 解決済みの同期先。利用者が貼ったフォルダ URL を Drive に問い合わせて組み立てる。
 *
 * 生の URL ではなくこれを持つのは、同期の判断に使う `folderId` と、利用者に見せる
 * 名前・所在を切り離さないため。`driveId` が空ならマイドライブで、これは表示上の
 * 区別であると同時に、変更ログをどちらから読むかの判断にも使う（ADR-0002）。
 */
export interface DriveTarget {
  /** 同期ルートのフォルダ ID。 */
  folderId: string;
  /** フォルダ名（表示用）。 */
  folderName: string;
  /** 所属する共有ドライブの ID。"" ならマイドライブ。 */
  driveId: string;
  /** 共有ドライブ名（表示用）。マイドライブなら ""。 */
  driveName: string;
}

export interface Settings {
  /** UI 言語。"auto" は Obsidian の表示言語に従う。 */
  language: LangPref;

  // --- Google OAuth クライアント（利用者が設定画面に貼る） ---
  oauthClientId: string;
  oauthClientSecret: string;
  /**
   * リフレッシュトークン。data.json に平文で入るが、data.json は `.obsidian/`
   * 配下にあり同期対象から常に外れる（ADR-0003）。
   */
  driveToken: string | null;

  // --- 同期先 ---
  /** 利用者が貼った URL そのもの。入力欄に出し直すためだけに持つ。 */
  targetUrl: string;
  /** 解決済みの同期先。未設定なら null。 */
  target: DriveTarget | null;
  /**
   * 共有Vault の入口にするローカルフォルダ。"" なら Vault 全体。
   * この直下が同期ルートの直下に対応する（マウントポイント: ADR-0004）。
   */
  mountFolder: string;

  // --- 同期の挙動 ---
  autoSync: boolean;
  /** リモートに変更があるかを確かめにいく間隔（分）。 */
  pollMinutes: number;
  /** 最後に同期が成立した時刻（epoch ms）。null は未同期。 */
  lastSyncAt: number | null;

  // --- 同期ルート単位で持ち越す状態（キーは folderId） ---
  /**
   * 前回同期時点のベースライン。同期ルートを変えるとキーが変わり、空から始まって
   * 全アップロードになる。古いベースラインを新しい空の場所に当てると全削除と
   * 解釈されるため、この分離は安全装置である（ADR-0004）。
   */
  syncState: Record<string, SyncStateData>;
  /** Changes API のページトークン。失っても「変更あり」として扱えば正しさは保たれる。 */
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
