import { HttpSend } from "../RemoteProvider";

const API = "https://www.googleapis.com/drive/v3";

/**
 * 同期ルートの中で変更があったかどうかだけを、Changes API で確かめる。
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

/** 同期ルートの中で起きたかを判断するための、changes.list の 1 件。 */
interface DriveChange {
  fileId?: string;
  removed?: boolean;
  file?: { parents?: string[] };
}

/**
 * 保存したトークンが使えないと Drive が返す状態。起点を取り直せば済むので、
 * 例外にせず「変更あり」に倒す。例外にすると、ポーリングは黙って失敗し続け、
 * ローカルで何か編集するまで他のメンバーの更新が届かなくなる。
 */
const STALE_TOKEN = new Set([400, 404, 410]);

/**
 * 同期ルートの中に関わる変更か。
 *
 * Changes API はドライブ全体の変更を返す。ルートの外だけで忙しい共有ドライブでは、
 * これを数えないと毎回の確認が全走査になる。ルートの中の ID は直前の走査で分かって
 * いるので、変更されたもの自身か、その親がそこに含まれていれば中の変更とみなす。
 * 外への移動や完全削除はそれ自身の ID で、中への移動や新規作成は親の ID で捕まる。
 */
function touches(c: DriveChange, inside: ReadonlySet<string>): boolean {
  if (!c.fileId) return false; // 共有ドライブ自体の設定変更など、ファイルに関わらないもの
  if (inside.has(c.fileId)) return true;
  if (c.removed) return false; // 見たことのない ID が消えただけ
  const parents = c.file?.parents;
  // 親が読めなければ中か外か判断できない。余計に同期する側に倒す。
  if (!parents || parents.length === 0) return true;
  return parents.some((p) => inside.has(p));
}

export interface ProbeResult {
  changed: boolean;
  /** 変更が無かったときの次の起点。ルートの外の変更を読み飛ばした先まで進んでいる。 */
  nextToken?: string;
}

/**
 * 保存したトークン以降に、同期ルートの中で変更があったか。
 *
 * 判断できないとき——トークンが無い、ルートの中の ID が分からない、トークンが
 * 使えない、応答が欠けている——は「変更あり」を返す。判定を誤る方向が常に
 * 「余計に同期する」側なので、正しさは失われない。
 */
export async function probeChanges(
  http: HttpSend,
  getToken: () => Promise<string>,
  driveId: string,
  savedToken: string,
  inside: ReadonlySet<string> | null
): Promise<ProbeResult> {
  if (!savedToken || !inside) return { changed: true };
  const fields = "nextPageToken,newStartPageToken,changes(fileId,removed,file(parents))";
  let pageToken = savedToken;
  for (;;) {
    const res = await http(
      "GET",
      `${API}/changes?pageToken=${encodeURIComponent(pageToken)}&pageSize=1000&fields=${encodeURIComponent(fields)}${scopeParams(driveId)}`,
      { authorization: `Bearer ${await getToken()}` }
    );
    if (STALE_TOKEN.has(res.status)) return { changed: true };
    const text = await res.text();
    if (res.status < 200 || res.status >= 300) throw new Error(`Drive changes.list ${res.status}: ${text.slice(0, 200)}`);
    const data = (text ? JSON.parse(text) : {}) as { changes?: DriveChange[]; nextPageToken?: string; newStartPageToken?: string };

    if ((data.changes ?? []).some((c) => touches(c, inside))) return { changed: true };
    if (data.nextPageToken) {
      pageToken = data.nextPageToken;
      continue;
    }
    return data.newStartPageToken ? { changed: false, nextToken: data.newStartPageToken } : { changed: true };
  }
}
