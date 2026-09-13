import { HttpSend } from "../RemoteProvider";

const API = "https://www.googleapis.com/drive/v3";

/**
 * 同期ルートを含むドライブに変更があったかどうかだけを、一度の問い合わせで確かめる。
 *
 * 同期の実体であるフォルダツリーの全走査はフォルダ数だけ順に API を呼ぶため、短い
 * 間隔では回せない。そこで Changes API は「変更があったか否か」の判定にだけ使い、
 * 差分の適用には使わない。返るのはパスではなくファイル ID であり、ID からパスへの
 * 対応表を持つ設計は、壊れたことに気づけないまま同期し続ける危険がある（ADR-0002）。
 *
 * 共有ドライブは独立した変更ログを持つため、`driveId` を指定しないと取りこぼす。
 */
function scopeParams(driveId: string): string {
  return driveId
    ? `&driveId=${encodeURIComponent(driveId)}&supportsAllDrives=true&includeItemsFromAllDrives=true`
    : "";
}

async function getJson<T>(http: HttpSend, url: string, getToken: () => Promise<string>, op: string): Promise<T> {
  const res = await http("GET", url, { authorization: `Bearer ${await getToken()}` });
  const text = await res.text();
  if (res.status < 200 || res.status >= 300) throw new Error(`Drive ${op} ${res.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * 「ここから先の変更を見る」起点。全走査の *前* に取ること。後から取ると、走査中に
 * 入った変更を見落とす。
 */
export async function getStartToken(
  http: HttpSend,
  getToken: () => Promise<string>,
  driveId: string
): Promise<string> {
  const data = await getJson<{ startPageToken?: string }>(
    http,
    `${API}/changes/startPageToken?fields=startPageToken${scopeParams(driveId)}`,
    getToken,
    "changes.getStartPageToken"
  );
  return data.startPageToken ?? "";
}

/**
 * 保存したトークン以降に変更があったか。トークンが無い（初回、あるいは失効）場合は
 * 「変更あり」として扱う。判定を誤る方向が常に「余計に同期する」側なので、正しさは
 * 失われない。
 */
export async function hasChanges(
  http: HttpSend,
  getToken: () => Promise<string>,
  driveId: string,
  savedToken: string
): Promise<boolean> {
  if (!savedToken) return true;
  // 1 件あれば十分。全ページを辿る必要はない——知りたいのは有無だけで、
  // 次の起点は同期の直前に取り直す。
  const data = await getJson<{ changes?: unknown[] }>(
    http,
    `${API}/changes?pageToken=${encodeURIComponent(savedToken)}&pageSize=1&fields=${encodeURIComponent("changes(fileId)")}${scopeParams(driveId)}`,
    getToken,
    "changes.list"
  );
  return (data.changes ?? []).length > 0;
}
