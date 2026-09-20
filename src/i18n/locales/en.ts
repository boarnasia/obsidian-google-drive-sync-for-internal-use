import { RelativeTimeWords } from "../../util/time";

/** 唯一の真実。`Strings` はここから導出するので、他の辞書の漏れはビルドエラーになる。 */
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

  // ------------------------------------------------------------ 同期管理パネル
  panelTitle: "Sync manager",
  panelOpen: "Open the sync manager",
  panelNeedsConnection: "Not connected. Connect to Google Drive in the plugin settings first.",
  panelNeedsTarget: "No sync target yet. Paste the folder URL in the plugin settings.",
  panelChecking: "Checking what has changed…",
  panelReady: "✓ Ready to sync.",
  panelBlocked: "⚠ Uploads are on hold.",
  reasonNoBaseline:
    'This vault has not been pulled from Drive yet, and both sides have files. Run "Pull from Drive" to bring the remote copy here first.',
  reasonVaultEmpty:
    'The local vault and Drive differ a lot: many files that Drive still lists are gone locally. Either delete them on Drive below, or run "Pull from Drive" to bring them back.',
  reasonDeleteGuard:
    'This sync would delete more files than the safety limit allows. Review the list below, or run "Pull from Drive" to bring the remote copy back.',
  panelActions: "Actions",
  btnClone: "Pull from Drive",
  btnRefresh: "Check status",
  panelLastSynced: (rel: string): string => `Last synced: ${rel}`,
  panelCheckedAt: (rel: string): string => `Checked: ${rel}`,
  panelHeldDeletes: (n: number): string => `Deletions on hold (${n})`,
  panelHeldDeletesDesc:
    "Nothing is deleted until you approve it. Approved files go to the trash: Drive empties its trash after 30 days, and an admin can still restore them for 25 days after that.",
  btnSelectAll: "Select all",
  btnApproveDeletes: (n: number): string => `Delete ${n} selected`,
  panelChanges: "Changes",
  panelUpload: "Upload",
  panelDownload: "Download",
  panelConflict: "Conflict",
  panelLocalOnly: "Local only",
  panelNoChanges: "Nothing to sync.",
  panelMore: (n: number): string => `…and ${n} more`,
  cloneDone: (down: number, conflicts: number, localOnly: number): string =>
    `clone done — ↓${down}, ${conflicts} conflict copy/copies, ${localOnly} local-only file(s)`,

  // ------------------------------------------------ ローカル固有ファイルの分類
  sectionUnsorted: "Unsorted",
  sectionShared: "Share",
  sectionTrash: "Delete",
  localOnlyIntro:
    'Files in this vault that Drive does not have. Move each line to Share or Delete, then run "Sort local files". This file is never synced.',
  localIgnoreTitle: "Your own ignore rules",
  localIgnoreBody:
    "Rules here apply only to your own vault; this file is never synced. Same syntax as _Sync/ignore.md: # is a comment, * ? ** are globs, a leading / anchors to the sync root, a trailing / matches folders, ! un-ignores.",
  btnOrganize: "Sort local files",
  panelUnsorted: "Unsorted",
  panelHeldUploads: "Held uploads",
  panelLocalOnlyDesc: "Uploads of new local files are on hold until the unsorted list is empty.",
  btnOpenLocalOnly: "Open the list",
  organizeDone: (shared: number, trashed: number): string =>
    `sorted local files — ${shared} to share, ${trashed} moved to the trash`,

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
