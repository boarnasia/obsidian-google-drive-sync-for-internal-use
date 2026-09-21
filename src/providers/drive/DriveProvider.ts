import { HttpResponse, HttpSend, PutResult, RemoteObject, RemoteProvider } from "../RemoteProvider";
import { runPool } from "../../util/pool";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
/** 一覧で同時に辿るフォルダ数。Drive のレート制限に当てない範囲で往復待ちを重ねる。 */
const LIST_CONCURRENCY = 8;

export interface DriveConfig {
  /**
   * 同期ルートのフォルダ ID。利用者が貼った URL から解決済みのものが渡る。
   * 名前でフォルダを探して作る、という段取りはここには無い——同期ルートは
   * すでに存在しているフォルダであり、作るものではない（ADR-0004）。
   */
  folderId: string;
  /**
   * 同期ルートが属する共有ドライブの ID。"" ならマイドライブ。
   *
   * 共有ドライブは利用者の既定のコーパスに入らないため、明示しないと files.list が
   * 黙ってマイドライブの結果だけを返す。同期エンジンはそれを「同期ルートが空」、
   * つまり全ファイルがリモートから消えたと読む。
   */
  driveId: string;
}

/** Escape a value for use inside a Drive `q` query (single-quote delimited). */
export function escapeDriveQuery(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** RFC3339 `modifiedTime` → epoch ms; `undefined` when absent or unparseable. */
function msOf(t?: string): number | undefined {
  if (!t) return undefined;
  const n = Date.parse(t);
  return Number.isNaN(n) ? undefined : n;
}

interface DriveFile {
  id?: string;
  name?: string;
  mimeType?: string;
  md5Checksum?: string;
  modifiedTime?: string;
  size?: string;
}

/**
 * Drive API v3 上の同期先。Vault のフォルダ構造は実際の Drive フォルダとして
 * 写され、リモートの見た目が Vault と一致する（平坦化しない）。ファイルのパスは
 * 所属フォルダ＋名前。認証（OAuth Bearer）と通信は注入される。
 *
 * 全 `drive` スコープを前提とする。`drive.file` は「そのユーザーに対してこのアプリが
 * 作成したファイル」しか見せないため、同じ共有ドライブ上でも他人のノートが存在
 * しないものとして扱われ、重複したツリーができる（ADR-0004）。
 */
export class DriveProvider implements RemoteProvider {
  readonly id = "drive";
  /**
   * dir ("" = root) -> folder id。値が Promise なのは、同じ新規フォルダへの
   * アップロードが並列に走ったときに二重作成しないため。最初の一つが作り、
   * 後続はその結果を待つ。
   */
  private readonly folderIds = new Map<string, Promise<string | null>>();
  /**
   * path -> file id。`list()` の走査で分かった ID を持ち越し、操作のたびに
   * 引き直さずに済ませる。これが無いと put / get / delete はどれも検索の
   * 1 往復を先に払うことになる。古くなっていれば 404 で気づき、引き直す。
   */
  private readonly fileIds = new Map<string, string>();

  constructor(
    private readonly cfg: DriveConfig,
    private readonly getToken: () => Promise<string>,
    private readonly http: HttpSend
  ) {}

  private async hdrs(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    return { authorization: `Bearer ${await this.getToken()}`, ...extra };
  }

  /**
   * Extra `files.list` parameters naming the shared drive. A shared drive is not
   * part of the user's default corpus, so it has to be named explicitly: without
   * these the API silently returns My Drive results only — which the engine would
   * read as "the sync root is empty", i.e. everything was deleted remotely. Empty
   * when syncing to My Drive, so those requests stay exactly as they were.
   */
  private listParams(): string {
    return this.cfg.driveId
      ? `&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${encodeURIComponent(this.cfg.driveId)}`
      : "";
  }

  /**
   * `supportsAllDrives` for the per-file calls (create / upload / get / trash),
   * which take no corpora. `sep` is the separator this call site needs: "&" when
   * the URL already carries a query string, "?" when it does not.
   */
  private allDrives(sep: "?" | "&"): string {
    return this.cfg.driveId ? `${sep}supportsAllDrives=true` : "";
  }

  private async json<T>(res: HttpResponse, op: string): Promise<T> {
    const text = await res.text();
    if (res.status < 200 || res.status >= 300) throw new Error(`Drive ${op} ${res.status}: ${text.slice(0, 200)}`);
    return (text ? JSON.parse(text) : {}) as T;
  }

  private dirOf(path: string): string {
    const i = path.lastIndexOf("/");
    return i < 0 ? "" : path.slice(0, i);
  }
  private baseOf(path: string): string {
    const i = path.lastIndexOf("/");
    return i < 0 ? path : path.slice(i + 1);
  }

  /** 同期ルート。解決済みのフォルダ ID をそのまま使う。 */
  private root(): string {
    return this.cfg.folderId;
  }

  /** Folder id for a "/"-separated dir under the root; `create=false` → null if missing. */
  private async folderFor(dir: string, create: boolean): Promise<string | null> {
    let parent: string | null = this.root();
    let acc = "";
    for (const seg of dir.split("/").filter(Boolean)) {
      acc = acc ? `${acc}/${seg}` : seg;
      parent = await this.folderSegment(acc, seg, parent, create);
      if (!parent) return null;
    }
    return parent;
  }

  /**
   * 1 段分。同じ段を同時に要求されても、問い合わせと作成は一度だけにする。
   *
   * 「無かった」もキャッシュする（同じ不在を何度も引かないため）。そこへ作る指示が
   * 来たら作り直すが、同じ待ちから目覚めた二つが揃って作ると同名フォルダが二つできる。
   * 目覚めた直後にキャッシュが差し替わっていないかを見て、差し替わっていれば
   * そちらを待つ。
   */
  private async folderSegment(acc: string, seg: string, parent: string, create: boolean): Promise<string | null> {
    for (;;) {
      const pending = this.folderIds.get(acc);
      if (pending) {
        const id = await pending;
        if (id) return id;
        if (!create) return null;
        if (this.folderIds.get(acc) !== pending) continue; // 先に目覚めた方が作り始めている
      }
      const resolving = (async () => {
        const found = await this.findFolder(seg, parent);
        return found ?? (create ? await this.createFolder(seg, parent) : null);
      })();
      this.folderIds.set(acc, resolving);
      return resolving;
    }
  }

  private async findFolder(name: string, parent: string): Promise<string | undefined> {
    const q = `mimeType='${FOLDER_MIME}' and name='${escapeDriveQuery(name)}' and '${escapeDriveQuery(parent)}' in parents and trashed=false`;
    const res = await this.http("GET", `${API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id)")}&spaces=drive${this.listParams()}`, await this.hdrs());
    return (await this.json<{ files?: DriveFile[] }>(res, "find-folder")).files?.[0]?.id;
  }

  private async createFolder(name: string, parent: string): Promise<string> {
    const meta = JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] });
    const cr = await this.http("POST", `${API}/files?fields=id${this.allDrives("&")}`, await this.hdrs({ "content-type": "application/json" }), new TextEncoder().encode(meta).buffer);
    return (await this.json<{ id: string }>(cr, "create-folder")).id;
  }

  /**
   * ファイル ID だけが要るとき。`list()` が埋めたキャッシュに当たればリクエストは 0 回。
   */
  private async fileId(path: string): Promise<string | null> {
    const cached = this.fileIds.get(path);
    if (cached) return cached;
    const found = await this.locate(path);
    if (found) this.fileIds.set(path, found.id);
    return found?.id ?? null;
  }

  private async locate(path: string): Promise<{ id: string; version: string; size: number; mtime?: number } | null> {
    const parent = await this.folderFor(this.dirOf(path), false);
    if (!parent) return null;
    const q = `name='${escapeDriveQuery(this.baseOf(path))}' and '${escapeDriveQuery(parent)}' in parents and mimeType!='${FOLDER_MIME}' and trashed=false`;
    const res = await this.http("GET", `${API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id,md5Checksum,modifiedTime,size)")}&spaces=drive${this.listParams()}`, await this.hdrs());
    const f = (await this.json<{ files?: DriveFile[] }>(res, "find")).files?.[0];
    return f?.id ? { id: f.id, version: f.md5Checksum ?? f.modifiedTime ?? "", size: Number(f.size ?? 0), mtime: msOf(f.modifiedTime) } : null;
  }

  async put(path: string, data: ArrayBuffer, contentType = "application/octet-stream", retry = true): Promise<PutResult> {
    let id = await this.fileId(path);
    if (!id) {
      const parent = (await this.folderFor(this.dirOf(path), true)) as string;
      const meta = JSON.stringify({ name: this.baseOf(path), parents: [parent] });
      const cr = await this.http("POST", `${API}/files?fields=id${this.allDrives("&")}`, await this.hdrs({ "content-type": "application/json" }), new TextEncoder().encode(meta).buffer);
      id = (await this.json<{ id: string }>(cr, "create")).id;
    }
    this.fileIds.set(path, id);
    const up = await this.upload(id, data, contentType);
    if (up.status === 404 && retry) {
      // キャッシュしていた ID が、他の誰かの削除や移動で使えなくなっていた。
      // 引き直して一度だけやり直す。無ければ作り直しになる。
      this.fileIds.delete(path);
      return this.put(path, data, contentType, false);
    }
    const r = await this.json<DriveFile>(up, "upload");
    return { version: r.md5Checksum ?? r.modifiedTime ?? "" };
  }

  private upload(id: string, data: ArrayBuffer, contentType: string): Promise<HttpResponse> {
    return this.hdrs({ "content-type": contentType }).then((h) =>
      this.http(
        "PATCH",
        `${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media&fields=${encodeURIComponent("md5Checksum,modifiedTime")}${this.allDrives("&")}`,
        h,
        data
      )
    );
  }

  async get(path: string): Promise<ArrayBuffer | null> {
    const id = await this.fileId(path);
    if (!id) return null;
    const res = await this.http("GET", `${API}/files/${encodeURIComponent(id)}?alt=media${this.allDrives("&")}`, await this.hdrs());
    if (res.status === 404) {
      this.fileIds.delete(path);
      return null;
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`Drive GET ${path}: ${res.status}`);
    return res.arrayBuffer();
  }

  async head(path: string): Promise<RemoteObject | null> {
    const f = await this.locate(path);
    return f ? { path, version: f.version, size: f.size, mtime: f.mtime } : null;
  }

  async delete(path: string): Promise<void> {
    const id = await this.fileId(path); // locate filters trashed=false → already-trashed/missing ⇒ no-op
    if (!id) return;
    this.fileIds.delete(path);
    // Soft-delete: move to Drive's trash (recoverable for ~30 days) instead of a
    // permanent files.delete, so a wrong "deleted locally" conclusion is never
    // irreversible — mirrors the local recoverable-trash policy.
    const body = new TextEncoder().encode(JSON.stringify({ trashed: true })).buffer;
    const res = await this.http("PATCH", `${API}/files/${encodeURIComponent(id)}${this.allDrives("?")}`, await this.hdrs({ "content-type": "application/json" }), body);
    if (res.status !== 404 && (res.status < 200 || res.status >= 300)) throw new Error(`Drive trash ${path}: ${res.status}`);
  }

  async list(prefix = ""): Promise<RemoteObject[]> {
    const out: RemoteObject[] = [];
    await this.walk(this.root(), "", out);
    if (!prefix) return out;
    const p = prefix.replace(/\/+$/, "");
    return out.filter((o) => o.path === p || o.path.startsWith(`${p}/`));
  }

  /**
   * 同期ルート以下を辿り、フォルダの連なりから各ファイルのパスを組み立てる。
   *
   * サブフォルダは並列に辿る。フォルダごとに 1 往復なので、順番に待つと
   * フォルダ数がそのまま待ち時間になる。
   */
  private async walk(folderId: string, prefix: string, out: RemoteObject[]): Promise<void> {
    const subfolders: { id: string; path: string }[] = [];
    let pageToken: string | undefined;
    do {
      // 同期ルートの ID は利用者が貼った URL から来る。q を閉じる文字が混ざっても
      // 別のフォルダを列挙しないよう、Drive から返った ID と同じく escape する。
      const q = `'${escapeDriveQuery(folderId)}' in parents and trashed=false`;
      let url =
        `${API}/files?q=${encodeURIComponent(q)}` +
        `&fields=${encodeURIComponent("nextPageToken,files(id,name,mimeType,md5Checksum,modifiedTime,size)")}` +
        `&pageSize=1000&spaces=drive${this.listParams()}`;
      if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
      const data = await this.json<{ files?: DriveFile[]; nextPageToken?: string }>(await this.http("GET", url, await this.hdrs()), "list");
      for (const f of data.files ?? []) {
        if (!f.name) continue;
        const childPath = prefix ? `${prefix}/${f.name}` : f.name;
        if (f.mimeType === FOLDER_MIME) {
          if (f.id) {
            this.folderIds.set(childPath, Promise.resolve(f.id));
            subfolders.push({ id: f.id, path: childPath });
          }
        } else {
          if (f.id) this.fileIds.set(childPath, f.id);
          out.push({ path: childPath, version: f.md5Checksum ?? f.modifiedTime ?? "", size: Number(f.size ?? 0), mtime: msOf(f.modifiedTime) });
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    await runPool(subfolders, LIST_CONCURRENCY, (sub) => this.walk(sub.id, sub.path, out));
  }
}
