/**
 * 失敗の種類分け。表示と、自動で再試行するかどうかを、ここだけで決める。
 *
 * 種類を分ける理由は二つある。自然に直るもの（スリープ復帰直後のネットワーク断、
 * Google の一時障害）を、利用者の操作を待たずに自分で拾い直すため。そして直らない
 * もの（認証切れ、権限）を、何分ごとにも叩き続けないためである。
 */
export type FailureKind =
  /** ネットワークが無い。接続が戻れば直る。 */
  | "network"
  /** 繋がるが Drive が応えない。一時障害と流量制限、応答待ちの時間切れ。 */
  | "server"
  /** 認証が通らない。再接続か、OAuth クライアントの直しが要る。 */
  | "auth"
  /** 同期先を開けない。フォルダの場所か権限が変わった。 */
  | "target"
  /** Drive の容量・ファイル数の上限。 */
  | "quota"
  /** 上のどれでもない。原文をそのまま出す。 */
  | "other";

/** 自然に直る見込みがあり、こちらから拾い直す価値がある種類。 */
export function isTransient(kind: FailureKind): boolean {
  return kind === "network" || kind === "server";
}

/** Electron が返すネットワークの失敗。Obsidian の requestUrl はこれをそのまま投げる。 */
const NETWORK = /net::ERR_|ERR_INTERNET_DISCONNECTED|ERR_NETWORK|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_ADDRESS_UNREACHABLE|ERR_PROXY|ERR_TIMED_OUT|Failed to fetch|NetworkError/i;
const TIMED_OUT = /timed out after/i;
const RATE_LIMIT = /rateLimitExceeded|userRateLimitExceeded|too many requests/i;
const QUOTA = /storageQuotaExceeded|teamDriveFileLimitExceeded|quotaExceeded|numChildrenInNonRootLimitExceeded/i;
const PERMISSION = /insufficientPermissions|insufficientFilePermissions|notFound|fileNotFound|forbidden/i;
/** `Drive list 503: …` や `OAuth token 400: …` の数字。 */
const STATUS = /\b(4\d\d|5\d\d)\b/;
const OAUTH = /^OAuth token/;

export function classifyFailure(error: unknown): FailureKind {
  const message = error instanceof Error ? error.message : String(error);

  if (NETWORK.test(message)) return "network";
  if (TIMED_OUT.test(message)) return "server";
  if (QUOTA.test(message)) return "quota";
  // 認証は流量制限と紛れない。トークンの発行だけが OAuth の窓口である。
  if (OAUTH.test(message)) return "auth";
  if (RATE_LIMIT.test(message)) return "server";

  const status = Number(STATUS.exec(message)?.[1] ?? 0);
  if (status === 401) return "auth";
  if (status === 429 || status >= 500) return "server";
  if (status === 403 || status === 404) return "target";
  if (PERMISSION.test(message)) return "target";
  return "other";
}
