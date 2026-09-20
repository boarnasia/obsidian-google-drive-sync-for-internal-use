import type { Strings } from "./en";

export const kn: Strings = {
  // ------------------------------------------------------------------ 全般
  notice: (msg) => `Google Drive Sync: ${msg}`,
  ribbonSyncNow: "Google Drive Sync: ಈಗ ಸಿಂಕ್ ಮಾಡಿ",
  cmdSyncNow: "ಈಗ ಸಿಂಕ್ ಮಾಡಿ",
  syncAlreadyRunning: "ಸಿಂಕ್ ಈಗಾಗಲೇ ನಡೆಯುತ್ತಿದೆ…",
  syncSummary: (up, down, del, conflicts) => `↑${up} ↓${down} ✗${del} ⚠${conflicts}`,
  syncErrorCount: (n) => ` — ${n} ದೋಷ(ಗಳು)`,
  syncDeferred: (n) => ` — ${n} ಅಳಿಸುವಿಕೆ(ಗಳು) ತಡೆಹಿಡಿಯಲಾಗಿದೆ`,
  relWords: {
    justNow: "ಈಗಷ್ಟೇ",
    minutes: (n: number) => (n === 1 ? "1 ನಿಮಿಷದ ಹಿಂದೆ" : `${n} ನಿಮಿಷಗಳ ಹಿಂದೆ`),
    hours: (n: number) => (n === 1 ? "1 ಗಂಟೆಯ ಹಿಂದೆ" : `${n} ಗಂಟೆಗಳ ಹಿಂದೆ`),
    days: (n: number) => (n === 1 ? "1 ದಿನದ ಹಿಂದೆ" : `${n} ದಿನಗಳ ಹಿಂದೆ`),
  },

  generalHeading: "ಸಾಮಾನ್ಯ",
  languageName: "ಭಾಷೆ",
  languageDesc:
    "“ಸ್ವಯಂಚಾಲಿತ” Obsidian ನ ಪ್ರದರ್ಶನ ಭಾಷೆಯನ್ನು (ಸೆಟ್ಟಿಂಗ್‌ಗಳು → ಕುರಿತು → ಭಾಷೆ) ಅನುಸರಿಸುತ್ತದೆ. ಆಜ್ಞೆ ಮತ್ತು ರಿಬ್ಬನ್ ಹೆಸರುಗಳು ಮುಂದಿನ ಮರುಲೋಡ್‌ನಲ್ಲಿ ಬದಲಾಗುತ್ತವೆ.",
  languageAliases: ["ಭಾಷೆ", "language"],
  languageAuto: "ಸ್ವಯಂಚಾಲಿತ (Obsidian ಗೆ ಹೊಂದಿಸಿ)",

  // --------------------------------------------------------- OAuth クライアント
  oauthHeading: "Google OAuth ಕ್ಲೈಂಟ್",
  oauthSetupRequired: "ಸೆಟಪ್ ಅಗತ್ಯವಿದೆ",
  oauthSetupDesc:
    "ಈ ಪ್ಲಗಿನ್ ಯಾವುದೇ ರುಜುವಾತುಗಳನ್ನು ಒಳಗೊಂಡಿಲ್ಲ. ನಿಮ್ಮ ಸಂಸ್ಥೆಯ ಕ್ಲೈಂಟ್ ID ಮತ್ತು ಸೀಕ್ರೆಟ್ ಅನ್ನು ಜವಾಬ್ದಾರರಿಂದ ಕೇಳಿ, ಅಥವಾ ಒಮ್ಮೆ ನೀವೇ ರಚಿಸಿ: ",
  oauthStep1: "Google Cloud Console ನ ರುಜುವಾತುಗಳ ಪುಟವನ್ನು ತೆರೆದು ಒಂದು ಪ್ರಾಜೆಕ್ಟ್ ಆಯ್ಕೆಮಾಡಿ (ಅಥವಾ ರಚಿಸಿ).",
  oauthStep2: "“Google Drive API” ಅನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿ.",
  oauthStep3: "OAuth ಸಮ್ಮತಿ ಪರದೆಯ User Type ಅನ್ನು “Internal” ಗೆ ಹೊಂದಿಸಿ.",
  oauthStep4: "ರುಜುವಾತುಗಳನ್ನು ರಚಿಸಿ → OAuth ಕ್ಲೈಂಟ್ ID → ಅಪ್ಲಿಕೇಶನ್ ಪ್ರಕಾರ “Desktop app”.",
  oauthClientIdName: "OAuth ಕ್ಲೈಂಟ್ ID",
  oauthClientIdDesc: "ನಿಮ್ಮ ಸಂಸ್ಥೆಯ Google Cloud OAuth ಕ್ಲೈಂಟ್‌ನ ಕ್ಲೈಂಟ್ ID.",
  oauthClientIdAliases: ["google", "ರುಜುವಾತು", "ಸೈನ್ ಇನ್", "ಲಾಗಿನ್", "credentials", "login"],
  oauthClientSecretName: "OAuth ಕ್ಲೈಂಟ್ ಸೀಕ್ರೆಟ್",
  oauthClientSecretDesc:
    "Google “Desktop app” ಕ್ಲೈಂಟ್‌ಗಳಿಗೆ ಅಗತ್ಯ. ಇದು ಈ ವಾಲ್ಟ್‌ನ ಪ್ಲಗಿನ್ ಡೇಟಾದಲ್ಲಿ ಮಾತ್ರ ಉಳಿಯುತ್ತದೆ ಮತ್ತು ಎಂದಿಗೂ ಸಿಂಕ್ ಆಗುವುದಿಲ್ಲ.",

  // -------------------------------------------------------------------- 同期先
  targetHeading: "ಸಿಂಕ್ ಗುರಿ",
  rowConnection: "ಸಂಪರ್ಕ",
  connected: "✓ ಸಂಪರ್ಕಗೊಂಡಿದೆ.",
  notConnected: "ಸಂಪರ್ಕಗೊಂಡಿಲ್ಲ.",
  btnConnect: "ಸಂಪರ್ಕಿಸಿ",
  btnReconnect: "ಮರುಸಂಪರ್ಕಿಸಿ",
  btnDisconnect: "ಸಂಪರ್ಕ ಕಡಿತಗೊಳಿಸಿ",
  connectedNotice: "Google Drive ಗೆ ಸಂಪರ್ಕಗೊಂಡಿದೆ.",
  disconnectedNotice: "Google Drive ನಿಂದ ಸಂಪರ್ಕ ಕಡಿತಗೊಂಡಿದೆ.",

  targetUrlName: "ಫೋಲ್ಡರ್ URL",
  targetUrlDesc:
    "ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಹಂಚಿದ ಡ್ರೈವ್‌ನ ಫೋಲ್ಡರ್ ತೆರೆದು ಅದರ ವಿಳಾಸವನ್ನು ಇಲ್ಲಿ ಅಂಟಿಸಿ. ತಂಡದ ಎಲ್ಲರೂ ಒಂದೇ ಫೋಲ್ಡರ್ ಬಳಸಬೇಕು.",
  targetUrlPlaceholder: "https://drive.google.com/drive/folders/…",
  myDriveName: "ನನ್ನ ಡ್ರೈವ್",
  targetStatusName: "ಗುರಿ",
  targetNotSet: "ಹೊಂದಿಸಲಾಗಿಲ್ಲ. ಮೇಲೆ ಫೋಲ್ಡರ್ URL ಅಂಟಿಸಿ.",
  targetResolving: "Drive ನಲ್ಲಿ ಫೋಲ್ಡರ್ ಹುಡುಕಲಾಗುತ್ತಿದೆ…",
  targetFailed: (reason) => `✗ ${reason}`,
  targetOnSharedDrive: (path) => `ಹಂಚಿದ ಡ್ರೈವ್ - ${path}`,
  targetOnMyDrive: (path) => `ನನ್ನ ಡ್ರೈವ್ - ${path}`,
  targetMyDriveWarning:
    "⚠ ನನ್ನ ಡ್ರೈವ್‌ನಲ್ಲಿರುವ (ವೈಯಕ್ತಿಕ) ಫೈಲ್‌ಗಳು ಬೇರೆ ಯಾರಿಗೂ ತಲುಪುವುದಿಲ್ಲ. ತಂಡದ ಸಿಂಕ್‌ಗೆ ಹಂಚಿದ ಡ್ರೈವ್‌ನ ಫೋಲ್ಡರ್ ಬಳಸಿ.",

  mountName: "ಸ್ಥಳೀಯ ಫೋಲ್ಡರ್",
  mountDesc:
    "ಈ ವಾಲ್ಟ್‌ನ ಯಾವ ಫೋಲ್ಡರ್ ಹಂಚಿದ ವಾಲ್ಟ್ ಆಗಿರಬೇಕು. ಅದರ ವಿಷಯಗಳು ಗುರಿ ಫೋಲ್ಡರ್‌ನ ವಿಷಯಗಳಿಗೆ ಹೊಂದಿಕೆಯಾಗುತ್ತವೆ — ಫೋಲ್ಡರ್ ಹೆಸರು Drive ನಲ್ಲಿ ಕಾಣಿಸುವುದಿಲ್ಲ, ಆದ್ದರಿಂದ ಪ್ರತಿಯೊಬ್ಬರೂ ಬೇರೆ ಹೆಸರು ಇಡಬಹುದು. ಖಾಲಿ = ಸಂಪೂರ್ಣ ವಾಲ್ಟ್.",
  mountPlaceholder: "(ಸಂಪೂರ್ಣ ವಾಲ್ಟ್)",
  mountMapping: (local) => `${local}/ ⇄ ಗುರಿ ಫೋಲ್ಡರ್`,
  mountMappingWholeVault: "ಸಂಪೂರ್ಣ ವಾಲ್ಟ್ ⇄ ಗುರಿ ಫೋಲ್ಡರ್",

  // -------------------------------------------------------------------- 同期
  syncHeading: "ಸಿಂಕ್",
  syncNowName: "ಈಗ ಸಿಂಕ್ ಮಾಡಿ",
  syncNowDescNever: "ಕೊನೆಯ ಸಿಂಕ್: ಎಂದೂ ಇಲ್ಲ",
  syncNowDesc: (rel, abs) => `ಕೊನೆಯ ಸಿಂಕ್: ${rel} (${abs})`,
  autoSyncName: "ಸ್ವಯಂ ಸಿಂಕ್",
  autoSyncDesc: "ನಿಮ್ಮ ಬದಲಾವಣೆಗಳು ತಕ್ಷಣ ಅಪ್‌ಲೋಡ್ ಆಗುತ್ತವೆ, ಇತರರ ಬದಲಾವಣೆಗಳನ್ನು ನಿಗದಿತ ಅಂತರದಲ್ಲಿ ತರಲಾಗುತ್ತದೆ.",
  pollName: "ಬದಲಾವಣೆ ಪರಿಶೀಲನೆಯ ಅಂತರ",
  pollDesc: "ಇತರರ ಬದಲಾವಣೆಗಳನ್ನು ಪರಿಶೀಲಿಸುವ ನಡುವಿನ ನಿಮಿಷಗಳು. ಬದಲಾವಣೆ ಇಲ್ಲದಿದ್ದರೆ ಪರಿಶೀಲನೆ ಒಂದೇ ಹಗುರ ವಿನಂತಿ.",
  pollUnit: "ನಿಮಿಷಗಳು",
  pollInvalid: "1 ಅಥವಾ ಹೆಚ್ಚಿನ ಪೂರ್ಣ ಸಂಖ್ಯೆಯನ್ನು (ನಿಮಿಷ) ನಮೂದಿಸಿ.",

  // ------------------------------------------------------------ 同期管理パネル
  panelTitle: "ಸಿಂಕ್ ನಿರ್ವಹಣೆ",
  panelOpen: "ಸಿಂಕ್ ನಿರ್ವಹಣೆ ತೆರೆಯಿರಿ",
  panelNeedsConnection: "ಸಂಪರ್ಕಗೊಂಡಿಲ್ಲ. ಮೊದಲು ಪ್ಲಗಿನ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ Google Drive ಗೆ ಸಂಪರ್ಕಿಸಿ.",
  panelNeedsTarget: "ಸಿಂಕ್ ಗುರಿ ಇನ್ನೂ ಇಲ್ಲ. ಪ್ಲಗಿನ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಫೋಲ್ಡರ್ URL ಅಂಟಿಸಿ.",
  panelChecking: "ಬದಲಾವಣೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…",
  panelReady: "✓ ಸಿಂಕ್ ಮಾಡಲು ಸಿದ್ಧ.",
  panelBlocked: "⚠ ಅಪ್‌ಲೋಡ್ ತಡೆಹಿಡಿಯಲಾಗಿದೆ.",
  reasonNoBaseline:
    "ಈ ವಾಲ್ಟ್ ಅನ್ನು ಇನ್ನೂ Drive ನಿಂದ ತಂದಿಲ್ಲ, ಮತ್ತು ಎರಡೂ ಕಡೆ ಫೈಲ್‌ಗಳಿವೆ. ಮೊದಲು “Drive ನಿಂದ ತನ್ನಿ” ಚಲಾಯಿಸಿ.",
  reasonVaultEmpty:
    "ರಿಮೋಟ್ ಮತ್ತು ಸ್ಥಳೀಯ ನಡುವೆ ದೊಡ್ಡ ವ್ಯತ್ಯಾಸವಿದೆ: Drive ನಲ್ಲಿ ಇರುವ ಹಲವು ಫೈಲ್‌ಗಳು ಸ್ಥಳೀಯವಾಗಿ ಅಳಿಸಲ್ಪಟ್ಟಿವೆ. ಕೆಳಗಿನಿಂದ ಅವುಗಳನ್ನು Drive ನಿಂದ ಅಳಿಸಿ, ಅಥವಾ “Drive ನಿಂದ ತನ್ನಿ” ಮೂಲಕ ಮರಳಿ ಪಡೆಯಿರಿ.",
  reasonDeleteGuard:
    "ಈ ಸಿಂಕ್ ಸುರಕ್ಷತಾ ಮಿತಿಗಿಂತ ಹೆಚ್ಚು ಫೈಲ್‌ಗಳನ್ನು ಅಳಿಸಲಿದೆ. ಕೆಳಗಿನ ಪಟ್ಟಿಯನ್ನು ನೋಡಿ, ಅಥವಾ “Drive ನಿಂದ ತನ್ನಿ” ಮೂಲಕ ರಿಮೋಟ್ ಪ್ರತಿಯನ್ನು ಮರಳಿ ಪಡೆಯಿರಿ.",
  panelActions: "ಕ್ರಿಯೆಗಳು",
  btnClone: "Drive ನಿಂದ ತನ್ನಿ",
  btnRefresh: "ಸ್ಥಿತಿ ನೋಡಿ",
  panelLastSynced: (rel) => `ಕೊನೆಯ ಸಿಂಕ್: ${rel}`,
  panelCheckedAt: (rel) => `ಪರಿಶೀಲನೆ: ${rel}`,
  panelHeldDeletes: (n) => `ತಡೆಹಿಡಿದ ಅಳಿಸುವಿಕೆಗಳು (${n})`,
  panelHeldDeletesDesc:
    "ನೀವು ಅನುಮೋದಿಸುವವರೆಗೆ ಏನನ್ನೂ ಅಳಿಸುವುದಿಲ್ಲ. ಅನುಮೋದಿಸಿದ ಫೈಲ್‌ಗಳು ಕಸದ ಬುಟ್ಟಿಗೆ ಹೋಗುತ್ತವೆ: Drive ಕಸದ ಬುಟ್ಟಿಯನ್ನು 30 ದಿನಗಳ ನಂತರ ಖಾಲಿ ಮಾಡುತ್ತದೆ, ನಂತರವೂ 25 ದಿನ ನಿರ್ವಾಹಕರು ಮರಳಿ ಪಡೆಯಬಹುದು.",
  btnSelectAll: "ಎಲ್ಲವನ್ನೂ ಆಯ್ಕೆಮಾಡಿ",
  btnApproveDeletes: (n) => `ಆಯ್ದ ${n} ಅನ್ನು ಅಳಿಸಿ`,
  panelChanges: "ಬದಲಾವಣೆಗಳು",
  panelUpload: "ಅಪ್‌ಲೋಡ್",
  panelDownload: "ಡೌನ್‌ಲೋಡ್",
  panelConflict: "ಸಂಘರ್ಷ",
  panelLocalOnly: "ಸ್ಥಳೀಯ ಮಾತ್ರ",
  panelNoChanges: "ಸಿಂಕ್ ಮಾಡಲು ಏನೂ ಇಲ್ಲ.",
  panelMore: (n) => `…ಇನ್ನೂ ${n}`,
  cloneDone: (down, conflicts, localOnly) =>
    `clone ಮುಗಿದಿದೆ — ↓${down}, ${conflicts} ಸಂಘರ್ಷ ಪ್ರತಿಗಳು, ${localOnly} ಸ್ಥಳೀಯ-ಮಾತ್ರ ಫೈಲ್‌ಗಳು`,

  // ---------------------------------------------------------- 利用者に出る失敗
  errNoOauthClient: "OAuth ಕ್ಲೈಂಟ್ ಹೊಂದಿಸಲಾಗಿಲ್ಲ — ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಕ್ಲೈಂಟ್ ID ಮತ್ತು ಸೀಕ್ರೆಟ್ ನಮೂದಿಸಿ, ನಂತರ ಸಂಪರ್ಕಿಸಿ.",
  errNoRefreshToken:
    "ರಿಫ್ರೆಶ್ ಟೋಕನ್ ಬಂದಿಲ್ಲ — myaccount.google.com ನಲ್ಲಿ ಈ ಆ್ಯಪ್‌ನ ಪ್ರವೇಶವನ್ನು ಹಿಂಪಡೆದು ಮತ್ತೆ ಸಂಪರ್ಕಿಸಿ.",
  errNotConnected: "ಮೊದಲು Google Drive ಗೆ ಸಂಪರ್ಕಿಸಿ.",
  errNoTarget: "ಸಿಂಕ್ ಗುರಿ ಹೊಂದಿಸಲಾಗಿಲ್ಲ — ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಫೋಲ್ಡರ್ URL ಅಂಟಿಸಿ.",
  errTargetEmpty: "ಫೋಲ್ಡರ್‌ನ URL (ಅಥವಾ ಅದರ ID) ಅಂಟಿಸಿ.",
  errTargetNotFound: "ಆ ಫೋಲ್ಡರ್ ಸಿಗಲಿಲ್ಲ, ಅಥವಾ ಈ ಖಾತೆಗೆ ಅದು ಕಾಣುವುದಿಲ್ಲ.",
  errTargetForbidden: "ಈ ಖಾತೆಗೆ ಆ ಫೋಲ್ಡರ್ ತೆರೆಯಲು ಅನುಮತಿ ಇಲ್ಲ.",
  errTargetNotFolder: "ಈ ಲಿಂಕ್ ಫೋಲ್ಡರ್ ಅಲ್ಲ, ಫೈಲ್ ಅನ್ನು ಸೂಚಿಸುತ್ತದೆ. ಫೋಲ್ಡರ್ ಅನ್ನೇ ತೆರೆದು ಅದರ ವಿಳಾಸವನ್ನು ನಕಲಿಸಿ.",
  errEmptyPath: "ಪಥ ಖಾಲಿಯಾಗಿದೆ",
  errOutsideMount: (path) => `ಸಿಂಕ್ ಫೋಲ್ಡರ್‌ನ ಹೊರಗಿನ ಪಥವನ್ನು ಮುಟ್ಟಲು ನಿರಾಕರಿಸಲಾಗಿದೆ: ${path}`,
  errLocalMissing: (path) => `ಸ್ಥಳೀಯ ಫೈಲ್ ಇಲ್ಲ: ${path}`,
};
