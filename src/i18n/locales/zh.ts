import type { Strings } from "./en";

/** 中文（简体，中国大陆）。 */
export const zh: Strings = {
  // ------------------------------------------------------------------ 全般
  notice: (msg) => `Google Drive Sync: ${msg}`,
  ribbonSyncNow: "Google Drive Sync：立即同步",
  cmdSyncNow: "立即同步",
  syncAlreadyRunning: "同步已在进行中…",
  syncSummary: (up, down, del, conflicts) => `↑${up} ↓${down} ✗${del} ⚠${conflicts}`,
  syncErrorCount: (n) => ` — ${n} 个错误`,
  syncDeferred: (n) => ` — 暂缓 ${n} 项删除`,
  relWords: {
    justNow: "刚刚",
    minutes: (n: number) => `${n} 分钟前`,
    hours: (n: number) => `${n} 小时前`,
    days: (n: number) => `${n} 天前`,
  },

  generalHeading: "常规",
  languageName: "语言",
  languageDesc: "“自动”跟随 Obsidian 的显示语言（设置 → 关于 → 语言）。命令和功能区名称将在下次重新加载后更新。",
  languageAliases: ["语言", "language"],
  languageAuto: "自动（跟随 Obsidian）",

  // --------------------------------------------------------- OAuth クライアント
  oauthHeading: "Google OAuth 客户端",
  oauthSetupRequired: "需要设置",
  oauthSetupDesc: "本插件不附带任何凭据。请向负责人索取贵组织的客户端 ID 和密钥，或自行创建一次：",
  oauthStep1: "打开 Google Cloud Console 的凭据页面，选择（或创建）一个项目。",
  oauthStep2: "启用“Google Drive API”。",
  oauthStep3: "将 OAuth 同意屏幕的用户类型设为“内部”。",
  oauthStep4: "创建凭据 → OAuth 客户端 ID → 应用类型“桌面应用”。",
  oauthClientIdName: "OAuth 客户端 ID",
  oauthClientIdDesc: "贵组织 Google Cloud OAuth 客户端的客户端 ID。",
  oauthClientIdAliases: ["google", "凭据", "登录", "credentials", "login"],
  oauthClientSecretName: "OAuth 客户端密钥",
  oauthClientSecretDesc: "Google“桌面应用”类型的客户端必须填写。仅保存在本仓库的插件数据中，永远不会被同步。",

  // -------------------------------------------------------------------- 同期先
  targetHeading: "同步目标",
  rowConnection: "连接状态",
  connected: "✓ 已连接。",
  notConnected: "未连接。",
  btnConnect: "连接",
  btnReconnect: "重新连接",
  btnDisconnect: "断开连接",
  connectedNotice: "已连接到 Google 云端硬盘。",
  disconnectedNotice: "已断开与 Google 云端硬盘的连接。",

  targetUrlName: "文件夹 URL",
  targetUrlDesc: "在浏览器中打开共享云端硬盘的文件夹，并将其地址粘贴到此处。团队所有成员必须使用同一个文件夹。",
  targetUrlPlaceholder: "https://drive.google.com/drive/folders/…",
  myDriveName: "我的云端硬盘",
  targetStatusName: "同步目标",
  targetNotSet: "未设置。请在上方粘贴文件夹 URL。",
  targetResolving: "正在云端硬盘中查找该文件夹…",
  targetFailed: (reason) => `✗ ${reason}`,
  targetOnSharedDrive: (path) => `共享云端硬盘 - ${path}`,
  targetOnMyDrive: (path) => `我的云端硬盘 - ${path}`,
  targetMyDriveWarning: "⚠ “我的云端硬盘”（个人）中的文件不会被其他人收到。团队同步请使用共享云端硬盘中的文件夹。",

  mountName: "本地文件夹",
  mountDesc:
    "将本仓库中的哪个文件夹作为共享仓库。其内容与同步目标文件夹的内容相对应；文件夹名本身不会出现在云端硬盘上，因此每个人都可以使用不同的名称。留空表示整个仓库。",
  mountPlaceholder: "（整个仓库）",
  mountMapping: (local) => `${local}/ ⇄ 同步目标文件夹`,
  mountMappingWholeVault: "整个仓库 ⇄ 同步目标文件夹",

  // -------------------------------------------------------------------- 同期
  syncHeading: "同步",
  syncNowName: "立即同步",
  syncNowDescNever: "上次同步：从未",
  syncNowDesc: (rel, abs) => `上次同步：${rel}（${abs}）`,
  autoSyncName: "自动同步",
  autoSyncDesc: "你的更改会随时上传，其他人的更改会定时获取。",
  pollName: "检查更改的间隔",
  pollDesc: "检查其他人更改的间隔（分钟）。没有更改时，每次检查只需一个轻量请求。",
  pollUnit: "分钟",
  pollInvalid: "请输入 1 或更大的整数（分钟）。",

  // ---------------------------------------------------------- 利用者に出る失敗
  errNoOauthClient: "未配置 OAuth 客户端。请在设置中输入客户端 ID 和密钥后再连接。",
  errNoRefreshToken: "未返回刷新令牌。请在 myaccount.google.com 撤销本应用的访问权限，然后重新连接。",
  errNotConnected: "请先连接 Google 云端硬盘。",
  errNoTarget: "未设置同步目标。请在设置中粘贴文件夹 URL。",
  errTargetEmpty: "请粘贴文件夹的 URL（或 ID）。",
  errTargetNotFound: "找不到该文件夹，或此账号无权查看。",
  errTargetForbidden: "此账号无权打开该文件夹。",
  errTargetNotFolder: "该链接指向文件而不是文件夹。请打开文件夹本身并复制其地址。",
  errEmptyPath: "路径为空",
  errOutsideMount: (path) => `拒绝操作同步文件夹之外的路径：${path}`,
  errLocalMissing: (path) => `本地文件已不存在：${path}`,
};
