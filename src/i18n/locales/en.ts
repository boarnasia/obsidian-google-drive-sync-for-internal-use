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
