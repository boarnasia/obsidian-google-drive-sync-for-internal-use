import { RelativeTimeWords } from "./util/time";

/**
 * UI 文字列。
 *
 * `en` が唯一の真実で、`Strings` はそこから導出する。したがって `ja` にキーの
 * 漏れ・綴り違い・引数の不一致があるとビルドが通らない。言語を足すことは
 * オブジェクトを一つ足すことであり、訳し忘れは実行時の英語混入ではなく
 * ビルドエラーになる。
 */
type Lang = "en" | "ja";

/**
 * ソースの生の値を言語コードに落とす。無ければ null。
 *
 * Obsidian はカスタム翻訳ファイルのパスを言語コードと同じ場所に保存するため、
 * パス区切りを含む値はコードではない（"/Users/jane/ja-custom.json" は日本語ではない）。
 * リージョンは落とす（"ja-JP" → "ja"）。Obsidian の日本語コードは "ja" である。
 */
export function codeOf(raw: string | null | undefined): string | null {
  if (!raw || raw.includes("/") || raw.includes("\\")) return null;
  return raw.toLowerCase().split(/[-_]/)[0] || null;
}

function storedLanguage(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage?.getItem("language") ?? null;
  } catch {
    return null;
  }
}

function navigatorLanguage(): string | null {
  try {
    return typeof navigator === "undefined" ? null : navigator.language || null;
  } catch {
    return null;
  }
}

/**
 * 「自動」が何に解決されるか。
 *
 * `obsidianLanguage` は obsidian モジュールの `getLanguage()`——正統な答え——であり、
 * import ではなく引数で渡す。この module は Node のテストパイロットにも束ねられ、
 * そこには import 元の Obsidian が無いため。
 *
 * `localStorage["language"]` だけを読むのでは足りない。Obsidian はこのキーを
 * 利用者が言語を明示的に選んだときにしか書かず、OS から継承した場合——よくある方——は
 * キーが存在しないままになる。`getLanguage()` はそのキーの読み取りに OS からの
 * フォールバックを足したものである。下位の段は、値が何も渡されなかったときだけ効く。
 */
function resolveAuto(obsidianLanguage?: string | null): Lang {
  const code = codeOf(obsidianLanguage) ?? codeOf(storedLanguage()) ?? codeOf(navigatorLanguage());
  return code === "ja" ? "ja" : "en";
}

export const en = {
  // ------------------------------------------------------------------ 全般
  notice: (msg: string): string => `Google Drive Sync: ${msg}`,
  ribbonSyncNow: "Google Drive Sync: sync now",
  cmdSyncNow: "Sync now",
  syncAlreadyRunning: "a sync is already running…",
  syncSummary: (up: number, down: number, del: number, conflicts: number): string =>
    `↑${up} ↓${down} ✗${del} ⚠${conflicts}`,
  syncErrorCount: (n: number): string => ` — ${n} error(s)`,
  syncDeferred: (n: number): string => ` — ${n} deletion(s) held back`,
  relWords: {
    justNow: "just now",
    minutes: (n: number) => `${n} minute${n === 1 ? "" : "s"} ago`,
    hours: (n: number) => `${n} hour${n === 1 ? "" : "s"} ago`,
    days: (n: number) => `${n} day${n === 1 ? "" : "s"} ago`,
  } as RelativeTimeWords,

  generalHeading: "General",
  languageName: "Language",
  languageDesc:
    "Automatic follows Obsidian's own display language (Settings → About → Language). Command and ribbon names follow on the next reload.",
  languageAliases: ["language", "japanese", "日本語", "言語"],
  languageAuto: "Automatic (match Obsidian)",
  languageEn: "English",
  languageJa: "日本語",

  // --------------------------------------------------------- OAuth クライアント
  oauthHeading: "Google OAuth client",
  oauthConfigured: "Client configured",
  oauthSetupRequired: "Set up required",
  oauthConfiguredDesc: "Sign-in uses the OAuth client configured below.",
  oauthSetupDesc:
    "This plugin ships with no credentials of its own. Ask whoever set this up for your organisation's client ID and secret, or create one once: ",
  oauthStep1: "Open the Google Cloud Console credentials page and pick (or create) a project.",
  oauthStep2: 'Enable the "Google Drive API".',
  oauthStep3: 'Set the OAuth consent screen User Type to "Internal".',
  oauthStep4: 'Create credentials → OAuth client ID → application type "Desktop app".',
  oauthClientIdName: "OAuth client ID",
  oauthClientIdDesc: "The client ID from your organisation's Google Cloud OAuth client.",
  oauthClientIdAliases: ["google", "credentials", "sign in", "login"],
  oauthClientSecretName: "OAuth client secret",
  oauthClientSecretDesc:
    'Required for Google "Desktop app" clients. Stored only in this vault\'s plugin data, which is never synced.',

  // -------------------------------------------------------------------- 同期先
  targetHeading: "Sync target",
  rowConnection: "Connection",
  connected: "✓ Connected.",
  notConnected: "Not connected.",
  btnConnect: "Connect",
  btnReconnect: "Reconnect",
  btnDisconnect: "Disconnect",
  connectedNotice: "connected to Google Drive.",
  disconnectedNotice: "disconnected from Google Drive.",

  targetUrlName: "Folder URL",
  targetUrlDesc:
    "Open the shared drive folder in your browser and paste its address here. Everyone on the team must use the same folder.",
  targetUrlPlaceholder: "https://drive.google.com/drive/folders/…",
  btnVerify: "Verify",
  targetVerifyName: "Check the target",
  targetVerifyDesc: "Look the folder up in Drive and show what it actually is.",
  targetVerifiedNotice: "sync target confirmed.",
  targetStatusName: "Target",
  targetNotSet: "Not set. Connect first, then paste the folder URL above and press Verify.",
  targetOnSharedDrive: (folder: string, drive: string): string => `✓ ${folder} — in the shared drive "${drive}"`,
  targetOnMyDrive: (folder: string): string =>
    `⚠ ${folder} — in My Drive (personal). Files here reach nobody else. Use a shared drive folder for team sync.`,

  mountName: "Local folder",
  mountDesc:
    "Which folder of this vault is the shared vault. Its contents map onto the target folder's contents — the folder name itself never appears on Drive, so everyone can name it differently. Blank = the whole vault.",
  mountPlaceholder: "(whole vault)",
  mountMapping: (local: string): string => `${local}/ ⇄ the target folder`,
  mountMappingWholeVault: "the whole vault ⇄ the target folder",

  // -------------------------------------------------------------------- 同期
  syncHeading: "Sync",
  syncNowName: "Sync now",
  syncNowDescNever: "Last synced: never",
  syncNowDesc: (rel: string, abs: string): string => `Last synced: ${rel} (${abs})`,
  autoSyncName: "Auto-sync",
  autoSyncDesc: "Upload your changes as they happen, and pick up other people's changes on a timer.",
  pollName: "Check for changes every",
  pollDesc:
    "Minutes between checks for other people's changes. A check is a single cheap request when nothing has changed.",
  pollUnit: "minutes",
  pollInvalid: "Enter a whole number of minutes, 1 or more.",

  // ---------------------------------------------------------- 利用者に出る失敗
  errNoOauthClient: "No OAuth client configured — enter the client ID and secret in settings, then connect.",
  errNoRefreshToken: "No refresh token returned — revoke the app at myaccount.google.com and connect again.",
  errNotConnected: "Connect to Google Drive first.",
  errNoTarget: "No sync target set — paste the folder URL in settings and press Verify.",
  errTargetEmpty: "Paste the folder's URL (or its ID).",
  errTargetNotFound: "That folder was not found, or this account cannot see it.",
  errTargetForbidden: "This account is not allowed to open that folder.",
  errTargetNotFolder: "That link points to a file, not a folder. Open the folder itself and copy its address.",
  errEmptyPath: "empty path",
  errOutsideMount: (path: string): string => `refusing to touch a path outside the synced folder: ${path}`,
  errLocalMissing: (path: string): string => `local file is gone: ${path}`,
};

export type Strings = typeof en;

export const ja: Strings = {
  // ------------------------------------------------------------------ 全般
  notice: (msg) => `Google Drive Sync: ${msg}`,
  ribbonSyncNow: "Google Drive Sync: 今すぐ同期",
  cmdSyncNow: "今すぐ同期",
  syncAlreadyRunning: "同期がすでに実行中です…",
  syncSummary: (up, down, del, conflicts) => `↑${up} ↓${down} ✗${del} ⚠${conflicts}`,
  syncErrorCount: (n) => ` — エラー ${n} 件`,
  syncDeferred: (n) => ` — 削除 ${n} 件を保留`,
  relWords: {
    justNow: "たった今",
    minutes: (n: number) => `${n} 分前`,
    hours: (n: number) => `${n} 時間前`,
    days: (n: number) => `${n} 日前`,
  },

  generalHeading: "全般",
  languageName: "言語",
  languageDesc:
    "「自動」は Obsidian 本体の表示言語（設定 → Obsidian について → 言語）に従います。コマンド名とリボンの名称は、次回の再読み込みで反映されます。",
  languageAliases: ["言語", "日本語", "language", "japanese"],
  languageAuto: "自動（Obsidian に合わせる）",
  languageEn: "English",
  languageJa: "日本語",

  // --------------------------------------------------------- OAuth クライアント
  oauthHeading: "Google OAuth クライアント",
  oauthConfigured: "設定済み",
  oauthSetupRequired: "設定が必要です",
  oauthConfiguredDesc: "下に設定された OAuth クライアントでサインインします。",
  oauthSetupDesc:
    "このプラグインに認証情報は同梱されていません。社内で用意されたクライアント ID とシークレットを担当者に確認するか、一度だけ作成してください: ",
  oauthStep1: "Google Cloud Console の認証情報ページを開き、プロジェクトを選択（または作成）します。",
  oauthStep2: "「Google Drive API」を有効化します。",
  oauthStep3: "OAuth 同意画面の User Type を「Internal」にします。",
  oauthStep4: "認証情報を作成 → OAuth クライアント ID → アプリケーションの種類「デスクトップアプリ」。",
  oauthClientIdName: "OAuth クライアント ID",
  oauthClientIdDesc: "社内の Google Cloud OAuth クライアントのクライアント ID。",
  oauthClientIdAliases: ["google", "認証情報", "サインイン", "ログイン", "credentials", "login"],
  oauthClientSecretName: "OAuth クライアント シークレット",
  oauthClientSecretDesc:
    "Google の「デスクトップアプリ」クライアントでは必須です。この Vault のプラグインデータ内にのみ保存され、同期されることはありません。",

  // -------------------------------------------------------------------- 同期先
  targetHeading: "同期先",
  rowConnection: "接続状態",
  connected: "✓ 接続済み。",
  notConnected: "未接続。",
  btnConnect: "接続",
  btnReconnect: "再接続",
  btnDisconnect: "接続を解除",
  connectedNotice: "Google ドライブに接続しました。",
  disconnectedNotice: "Google ドライブの接続を解除しました。",

  targetUrlName: "フォルダの URL",
  targetUrlDesc:
    "ブラウザで共有ドライブのフォルダを開き、そのアドレスを貼り付けてください。チーム全員が同じフォルダを指定する必要があります。",
  targetUrlPlaceholder: "https://drive.google.com/drive/folders/…",
  btnVerify: "確認",
  targetVerifyName: "同期先を確認",
  targetVerifyDesc: "Drive に問い合わせて、そのフォルダが実際に何なのかを表示します。",
  targetVerifiedNotice: "同期先を確認しました。",
  targetStatusName: "同期先",
  targetNotSet: "未設定です。先に接続し、上にフォルダの URL を貼って「確認」を押してください。",
  targetOnSharedDrive: (folder, drive) => `✓ ${folder} — 共有ドライブ「${drive}」内`,
  targetOnMyDrive: (folder) =>
    `⚠ ${folder} — マイドライブ（個人）内。ここに置いても他の誰にも届きません。チームで使うなら共有ドライブのフォルダを指定してください。`,

  mountName: "ローカルのフォルダ",
  mountDesc:
    "この Vault のどのフォルダを共有Vault にするか。その中身が同期先フォルダの中身に対応します。フォルダ名自体は Drive 上に現れないので、各自が別の名前を付けて構いません。空欄なら Vault 全体。",
  mountPlaceholder: "（Vault 全体）",
  mountMapping: (local) => `${local}/ ⇄ 同期先フォルダ`,
  mountMappingWholeVault: "Vault 全体 ⇄ 同期先フォルダ",

  // -------------------------------------------------------------------- 同期
  syncHeading: "同期",
  syncNowName: "今すぐ同期",
  syncNowDescNever: "最終同期: なし",
  syncNowDesc: (rel, abs) => `最終同期: ${rel}（${abs}）`,
  autoSyncName: "自動同期",
  autoSyncDesc: "自分の変更はその都度アップロードし、他の人の変更は一定時間ごとに取りに行きます。",
  pollName: "他の人の変更を確認する間隔",
  pollDesc:
    "他の人の変更を確認しに行く間隔（分）。変更が無ければ 1 リクエストで終わるため、短くしても負荷は軽微です。",
  pollUnit: "分",
  pollInvalid: "1 以上の整数（分）を入力してください。",

  // ---------------------------------------------------------- 利用者に出る失敗
  errNoOauthClient:
    "OAuth クライアントが設定されていません。設定画面でクライアント ID とシークレットを入力してから接続してください。",
  errNoRefreshToken:
    "リフレッシュトークンが返されませんでした。myaccount.google.com でこのアプリのアクセス権を取り消してから、接続し直してください。",
  errNotConnected: "先に Google ドライブに接続してください。",
  errNoTarget: "同期先が未設定です。設定画面でフォルダの URL を貼り、「確認」を押してください。",
  errTargetEmpty: "フォルダの URL（または ID）を貼り付けてください。",
  errTargetNotFound: "そのフォルダが見つからないか、このアカウントからは参照できません。",
  errTargetForbidden: "このアカウントにはそのフォルダを開く権限がありません。",
  errTargetNotFolder:
    "そのリンクはフォルダではなくファイルを指しています。フォルダ自体を開いて、そのアドレスをコピーしてください。",
  errEmptyPath: "パスが空です",
  errOutsideMount: (path) => `同期対象フォルダの外を操作しようとしたため中止しました: ${path}`,
  errLocalMissing: (path) => `ローカルのファイルが見つかりません: ${path}`,
};

/** 利用者が指定した言語、あるいは「Obsidian に従う」。 */
export type LangPref = "auto" | "en" | "ja";

/**
 * 現在の文字列。
 *
 * 中身を入れ替える安定したオブジェクトである。`t` を import した各モジュールは
 * 再 import なしに現在の言語を読み続け、文字列を読む約 100 箇所は関数呼び出しを
 * しなくて済む。設定が読み込まれる前にこの module が初期化されるため検出言語で
 * 始まり、読み込まれ次第 `setLanguage` が保存された選択で上書きする。
 */
export const t: Strings = { ...(resolveAuto() === "ja" ? ja : en) };

export function setLanguage(pref: LangPref, obsidianLanguage?: string | null): void {
  const lang: Lang = pref === "auto" ? resolveAuto(obsidianLanguage) : pref;
  Object.assign(t, lang === "ja" ? ja : en);
}
