import type { Strings } from "./en";

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
  languageAliases: ["言語", "language"],
  languageAuto: "自動（Obsidian に合わせる）",

  // --------------------------------------------------------- OAuth クライアント
  oauthHeading: "Google OAuth クライアント",
  oauthSetupRequired: "設定が必要です",
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
  myDriveName: "マイドライブ",
  targetStatusName: "同期先",
  targetNotSet: "未設定です。上にフォルダの URL を貼ってください。",
  targetResolving: "Drive でフォルダを確認しています…",
  targetFailed: (reason) => `✗ ${reason}`,
  targetOnSharedDrive: (path) => `共有ドライブ - ${path}`,
  targetOnMyDrive: (path) => `マイドライブ - ${path}`,
  targetMyDriveWarning:
    "⚠ マイドライブ（個人）に置いても他の誰にも届きません。チームで使うなら共有ドライブのフォルダを指定してください。",

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
  errNoTarget: "同期先が未設定です。設定画面でフォルダの URL を貼ってください。",
  errTargetEmpty: "フォルダの URL（または ID）を貼り付けてください。",
  errTargetNotFound: "そのフォルダが見つからないか、このアカウントからは参照できません。",
  errTargetForbidden: "このアカウントにはそのフォルダを開く権限がありません。",
  errTargetNotFolder:
    "そのリンクはフォルダではなくファイルを指しています。フォルダ自体を開いて、そのアドレスをコピーしてください。",
  errEmptyPath: "パスが空です",
  errOutsideMount: (path) => `同期対象フォルダの外を操作しようとしたため中止しました: ${path}`,
  errLocalMissing: (path) => `ローカルのファイルが見つかりません: ${path}`,
};
