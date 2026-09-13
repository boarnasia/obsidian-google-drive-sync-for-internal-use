import { HttpSend } from "../RemoteProvider";
import { DriveTarget } from "../../settings";
import { t } from "../../i18n";

const API = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * 貼られた文字列からフォルダ ID を取り出す。
 *
 * 利用者が手元に持っているのはアドレスバーの URL であってフォルダ ID ではないので、
 * URL を第一級の入力として扱い、生の ID は後始末として受け付ける。共有ドライブの
 * ルートも、その中のフォルダも、マイドライブのフォルダも、すべて同じ
 * `/drive/folders/<ID>` の形で表される（ADR-0004）。
 */
export function parseFolderId(input: string): string {
  const s = input.trim();
  if (!s) return "";
  // .../drive/folders/<id>、.../drive/u/0/folders/<id>、末尾に ?usp=drive_link など。
  const m = s.match(/\/folders\/([^/?#]+)/);
  if (m) return m[1];
  // URL でなければ ID そのものとみなし、貼り付けに紛れ込んだ余計な部分だけ落とす。
  return s.replace(/[?#].*$/, "");
}

interface DriveFileMeta {
  id?: string;
  name?: string;
  mimeType?: string;
  /** 共有ドライブ配下のファイルにのみ設定される。マイドライブなら欠落する。 */
  driveId?: string;
}

async function getJson<T>(http: HttpSend, url: string, token: string, op: string): Promise<T> {
  const res = await http("GET", url, { authorization: `Bearer ${token}` });
  const text = await res.text();
  if (res.status === 404) throw new Error(t.errTargetNotFound);
  if (res.status === 403) throw new Error(t.errTargetForbidden);
  if (res.status < 200 || res.status >= 300) throw new Error(`Drive ${op} ${res.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * 貼られた URL を Drive に問い合わせて同期先に変換する。
 *
 * 名前と所在を必ず取りに行くのは表示のためだけではない。共有ドライブのつもりで
 * マイドライブのフォルダを貼った場合、本人だけが同期できて他の誰にも届かず、
 * しかも正常に動いているように見える。その取り違えを、同期を始める前に
 * 目で捕まえられるようにする（ADR-0004）。
 */
export async function resolveDriveTarget(
  http: HttpSend,
  getToken: () => Promise<string>,
  input: string
): Promise<DriveTarget> {
  const folderId = parseFolderId(input);
  if (!folderId) throw new Error(t.errTargetEmpty);

  const token = await getToken();
  const file = await getJson<DriveFileMeta>(
    http,
    `${API}/files/${encodeURIComponent(folderId)}?supportsAllDrives=true&fields=${encodeURIComponent("id,name,mimeType,driveId")}`,
    token,
    "files.get"
  );

  // ファイルの URL を貼ってしまった場合をここで止める。止めないと、その「フォルダ」
  // の子を列挙して常に空が返り、Vault 全体が削除されたように見える。
  if (file.mimeType !== FOLDER_MIME) throw new Error(t.errTargetNotFolder);

  const driveId = file.driveId ?? "";
  let driveName = "";
  if (driveId) {
    const drive = await getJson<{ name?: string }>(
      http,
      `${API}/drives/${encodeURIComponent(driveId)}?fields=name`,
      token,
      "drives.get"
    );
    driveName = drive.name || driveId;
  }

  return { folderId: file.id || folderId, folderName: file.name || folderId, driveId, driveName };
}
