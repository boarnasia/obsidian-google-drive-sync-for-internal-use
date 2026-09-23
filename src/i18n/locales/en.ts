import { RelativeTimeWords } from "../../util/time";

/** 唯一の真実。`Strings` はここから導出するので、他の辞書の漏れはビルドエラーになる。 */
export const en = {
  // ------------------------------------------------------------------ 全般
  notice: (msg: string): string => `Team Drive Sync: ${msg}`,
  ribbonSyncNow: "Team Drive Sync: sync now",
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
  languageAliases: ["language"],
  languageAuto: "Automatic (match Obsidian)",

  // --------------------------------------------------------- OAuth クライアント
  oauthHeading: "Google OAuth client",
  oauthSetupRequired: "Set up required",
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
  myDriveName: "My Drive",
  targetStatusName: "Target",
  targetNotSet: "Not set. Paste the folder URL above.",
  targetResolving: "Looking up the folder in Drive…",
  targetFailed: (reason: string): string => `✗ ${reason}`,
  targetOnSharedDrive: (path: string): string => `Shared drive - ${path}`,
  targetOnMyDrive: (path: string): string => `My Drive - ${path}`,
  targetMyDriveWarning: "⚠ Files in My Drive (personal) reach nobody else. Use a shared drive folder for team sync.",

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
  syncMovedDesc: "The sync controls and settings live in the sync manager, in the right sidebar.",

  // ------------------------------------------------------------ 同期管理パネル
  panelTitle: "Sync manager",
  panelOpen: "Open the sync manager",
  panelNeedsConnection: "Not connected. Connect to Google Drive in the plugin settings first.",
  panelNeedsTarget: "No sync target yet. Paste the folder URL in the plugin settings.",
  panelChecking: "Checking what has changed…",
  panelReady: "✓ Ready to sync.",
  panelBlocked: "⚠ Uploads are on hold.",
  panelSyncFailed: (message: string): string => `✗ Last sync failed: ${message}`,
  reasonNoBaseline:
    'This vault has not been pulled from Drive yet, and both sides have files. Run "Pull from Drive" to bring the remote copy here first.',
  reasonVaultEmpty:
    'The local vault and Drive differ a lot: many files that Drive still lists are gone locally. Either delete them on Drive below, or run "Pull from Drive" to bring them back.',
  reasonDeleteGuard:
    'This sync would delete more files than the safety limit allows. Review the list below, or run "Pull from Drive" to bring the remote copy back.',
  panelActions: "Actions",
  btnClone: "Pull from Drive",
  btnRefresh: "Check status",
  tipSyncNow: "Send your changes to Drive and bring other people's changes here.",
  tipClone: "Bring the Drive copy here. Nothing local is deleted; files Drive does not have are listed below.",
  tipRefresh: "Count the differences again. Nothing is uploaded, downloaded or deleted.",
  panelLastSynced: (rel: string): string => `Last synced: ${rel}`,
  panelCheckedAt: (rel: string): string => `Checked: ${rel}`,
  panelHeldDeletes: (n: number): string => `Deletions on hold (${n})`,
  panelHeldDeletesDesc:
    "Nothing is deleted until you approve it. Approved files go to the trash: Drive empties its trash after 30 days, and an admin can still restore them for 25 days after that.",
  btnSelectAll: "Select all",
  btnApproveDeletes: (n: number): string => `Delete ${n} selected`,
  tipSelectAll: "Tick every file in the list above.",
  tipApproveDeletes: "Delete the ticked files and finish this sync.",
  panelChanges: "Changes",
  panelUpload: "Upload",
  panelDownload: "Download",
  panelConflict: "Conflict",
  panelDeleteLocal: "Delete locally",
  panelDeleteRemote: "Delete on Drive",
  panelLocalOnly: "Local only",
  panelNoChanges: "Nothing to sync.",
  panelMore: (n: number): string => `…and ${n} more`,
  cloneDone: (down: number, conflicts: number, localOnly: number): string =>
    `clone done — ↓${down}, ${conflicts} conflict copy/copies, ${localOnly} local-only file(s)`,

  // ------------------------------------------------------------ 失敗の知らせ方
  failNetwork: "No network connection. Syncing resumes on its own once the connection is back. To try right now, press “Check status”.",
  failServer: "Google Drive is not responding right now. Syncing resumes on its own shortly.",
  failAuth: "Your Google sign-in has expired. Reconnect from the settings.",
  failTarget: "The sync folder cannot be opened. Check that it is not in the trash and that you still have access to the shared drive.",
  failQuota: "Drive is out of space, or the file limit was reached. Ask your administrator.",
  failDetail: (m: string): string => `details: ${m}`,
  btnOpenSettings: "Open settings",
  tipOpenSettings: "Open the plugin settings to reconnect",
  failRetryIn: (x: string): string => `retrying in about ${x}`,

  // ------------------------------------------------------------ 取り込みの進み具合
  progressTitle: "Importing from Drive",
  progressScan: (n: number): string => `Listing files… ${n} on Drive`,
  progressScanLocal: (d: number, t: number): string => `checking ${d} / ${t} here`,
  progressFinishing: "Finishing up…",
  progressFiles: (d: number, t: number): string => `${d} / ${t} files`,
  progressRemaining: (x: string): string => `about ${x} left`,
  durationSeconds: (n: number): string => `${n} s`,
  durationMinutes: (n: number): string => `${n} min`,
  progressFailed: (n: number): string => `${n} failed`,
  btnCancelClone: "Cancel",
  tipCancelClone: "Stop importing. Files already downloaded stay; nothing is recorded as synced.",
  cloneAborted: (n: number): string => `import cancelled — ${n} file(s) already downloaded stay here`,
  statusBarClone: (p: number): string => `Importing ${p}%`,
  statusBarScan: "Importing…",

  // ------------------------------------------------------------ 設定ファイル
  panelConfigFiles: "Config files",
  panelIgnoreDesc:
    "The team's ignore rules live in .tds-ignore at the top of the synced folder. Obsidian does not list dot files, so open it in a text editor.",
  btnOpenFile: "Open",
  tipOpenFile: "Open in your text editor",
  btnCopyPath: "Copy path",
  tipCopyPath: "Copy the full path to the clipboard",
  pathCopied: (p: string): string => `copied: ${p}`,
  errOpenFailed: (m: string): string => `could not open the file: ${m}`,

  // ------------------------------------------------------------ 版の目印
  panelVersionBehind: (mine: string, team: string): string =>
    `This plugin is out of date (yours ${mine}, team ${team}). Sync is paused until you update.`,
  panelVersionBehindDesc: "Update the plugin with BRAT. Sync resumes as soon as the versions match.",
  btnUpdateViaBrat: "Update with BRAT",
  tipUpdateViaBrat: "Run BRAT's check-for-updates-and-update command",
  errVersionBehind: (mine: string, team: string): string =>
    `this plugin (${mine}) is older than the team's (${team}); update it to sync`,

  // ------------------------------------------------ ローカル固有ファイルの分類
  panelUnsorted: (n: number): string => `Not decided yet (${n})`,
  panelLocalOnlyDesc: "Drive does not have these files. Each one stays here, unsent, until you decide.",
  btnShare: "Share",
  btnTrash: "Delete",
  btnShareAll: (n: number): string => `Share all ${n}`,
  btnTrashAll: (n: number): string => `Delete all ${n}`,
  tipShare: "Upload this file to Drive, so the team gets it.",
  tipTrash: "Move this file to the trash. Drive is not touched — it never had this file.",
  tipShareAll: "Upload every file in the list to Drive.",
  tipTrashAll: "Move every file in the list to the trash.",
  confirmTrashTitle: "Delete these files?",
  confirmTrashBody: (n: number): string =>
    `${n} file(s) go to the trash. They are not on Drive, so this is the only copy — you can still restore them from the trash.`,
  btnCancel: "Cancel",
  sharedDone: (n: number): string => `${n} file(s) shared`,
  trashedDone: (n: number): string => `${n} file(s) moved to the trash`,

  // ---------------------------------------------------------- 利用者に出る失敗
  errNoOauthClient: "No OAuth client configured — enter the client ID and secret in settings, then connect.",
  errNoRefreshToken: "No refresh token returned — revoke the app at myaccount.google.com and connect again.",
  errNotConnected: "Connect to Google Drive first.",
  errNoTarget: "No sync target set — paste the folder URL in settings.",
  errTargetEmpty: "Paste the folder's URL (or its ID).",
  errTargetNotFound: "That folder was not found, or this account cannot see it.",
  errTargetForbidden: "This account is not allowed to open that folder.",
  errTargetNotFolder: "That link points to a file, not a folder. Open the folder itself and copy its address.",
  errEmptyPath: "empty path",
  errOutsideMount: (path: string): string => `refusing to touch a path outside the synced folder: ${path}`,
  errLocalMissing: (path: string): string => `local file is gone: ${path}`,
};

export type Strings = typeof en;
