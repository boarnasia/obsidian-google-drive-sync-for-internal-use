import { HttpResponse, HttpSend, PutResult, RemoteObject, RemoteProvider } from "../RemoteProvider";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

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
  private readonly folderIds = new Map<string, string>(); // dir ("" = root) -> folder id

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
  private async root(): Promise<string> {
    this.folderIds.set("", this.cfg.folderId);
    return this.cfg.folderId;
  }

  /** Folder id for a "/"-separated dir under the root; `create=false` → null if missing. */
  private async folderFor(dir: string, create: boolean): Promise<string | null> {
    const cached = this.folderIds.get(dir);
    if (cached) return cached;
    let parent = await this.root();
    let acc = "";
    for (const seg of dir.split("/").filter(Boolean)) {
      acc = acc ? `${acc}/${seg}` : seg;
      let id = this.folderIds.get(acc);
      if (!id) {
        const found = await this.findFolder(seg, parent);
        id = found ?? (create ? await this.createFolder(seg, parent) : undefined);
        if (!id) return null;
        this.folderIds.set(acc, id);
      }
      parent = id;
    }
    return parent;
  }

  private async findFolder(name: string, parent: string): Promise<string | undefined> {
    const q = `mimeType='${FOLDER_MIME}' and name='${escapeDriveQuery(name)}' and '${parent}' in parents and trashed=false`;
    const res = await this.http("GET", `${API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id)")}&spaces=drive${this.listParams()}`, await this.hdrs());
    return (await this.json<{ files?: DriveFile[] }>(res, "find-folder")).files?.[0]?.id;
  }

  private async createFolder(name: string, parent: string): Promise<string> {
    const meta = JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] });
    const cr = await this.http("POST", `${API}/files?fields=id${this.allDrives("&")}`, await this.hdrs({ "content-type": "application/json" }), new TextEncoder().encode(meta).buffer);
    return (await this.json<{ id: string }>(cr, "create-folder")).id;
  }

  private async locate(path: string): Promise<{ id: string; version: string; size: number; mtime?: number } | null> {
    const parent = await this.folderFor(this.dirOf(path), false);
    if (!parent) return null;
    const q = `name='${escapeDriveQuery(this.baseOf(path))}' and '${parent}' in parents and mimeType!='${FOLDER_MIME}' and trashed=false`;
    const res = await this.http("GET", `${API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent("files(id,md5Checksum,modifiedTime,size)")}&spaces=drive${this.listParams()}`, await this.hdrs());
    const f = (await this.json<{ files?: DriveFile[] }>(res, "find")).files?.[0];
    return f?.id ? { id: f.id, version: f.md5Checksum ?? f.modifiedTime ?? "", size: Number(f.size ?? 0), mtime: msOf(f.modifiedTime) } : null;
  }

  async put(path: string, data: ArrayBuffer, contentType = "application/octet-stream"): Promise<PutResult> {
    let id = (await this.locate(path))?.id;
    if (!id) {
      const parent = (await this.folderFor(this.dirOf(path), true)) as string;
      const meta = JSON.stringify({ name: this.baseOf(path), parents: [parent] });
      const cr = await this.http("POST", `${API}/files?fields=id${this.allDrives("&")}`, await this.hdrs({ "content-type": "application/json" }), new TextEncoder().encode(meta).buffer);
      id = (await this.json<{ id: string }>(cr, "create")).id;
    }
    const up = await this.http(
      "PATCH",
      `${UPLOAD}/files/${id}?uploadType=media&fields=${encodeURIComponent("md5Checksum,modifiedTime")}${this.allDrives("&")}`,
      await this.hdrs({ "content-type": contentType }),
      data
    );
    const r = await this.json<DriveFile>(up, "upload");
    return { version: r.md5Checksum ?? r.modifiedTime ?? "" };
  }

  async get(path: string): Promise<ArrayBuffer | null> {
    const f = await this.locate(path);
    if (!f) return null;
    const res = await this.http("GET", `${API}/files/${f.id}?alt=media${this.allDrives("&")}`, await this.hdrs());
    if (res.status === 404) return null;
    if (res.status < 200 || res.status >= 300) throw new Error(`Drive GET ${path}: ${res.status}`);
    return res.arrayBuffer();
  }

  async head(path: string): Promise<RemoteObject | null> {
    const f = await this.locate(path);
    return f ? { path, version: f.version, size: f.size, mtime: f.mtime } : null;
  }

  async delete(path: string): Promise<void> {
    const f = await this.locate(path); // locate filters trashed=false → already-trashed/missing ⇒ no-op
    if (!f) return;
    // Soft-delete: move to Drive's trash (recoverable for ~30 days) instead of a
    // permanent files.delete, so a wrong "deleted locally" conclusion is never
    // irreversible — mirrors the local recoverable-trash policy.
    const body = new TextEncoder().encode(JSON.stringify({ trashed: true })).buffer;
    const res = await this.http("PATCH", `${API}/files/${f.id}${this.allDrives("?")}`, await this.hdrs({ "content-type": "application/json" }), body);
    if (res.status !== 404 && (res.status < 200 || res.status >= 300)) throw new Error(`Drive trash ${path}: ${res.status}`);
  }

  async list(prefix = ""): Promise<RemoteObject[]> {
    const out: RemoteObject[] = [];
    await this.walk(await this.root(), "", out);
    if (!prefix) return out;
    const p = prefix.replace(/\/+$/, "");
    return out.filter((o) => o.path === p || o.path.startsWith(`${p}/`));
  }

  /** Depth-first traversal of the sync root, reconstructing each file's path from the folder chain. */
  private async walk(folderId: string, prefix: string, out: RemoteObject[]): Promise<void> {
    let pageToken: string | undefined;
    do {
      const q = `'${folderId}' in parents and trashed=false`;
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
            this.folderIds.set(childPath, f.id);
            await this.walk(f.id, childPath, out);
          }
        } else {
          out.push({ path: childPath, version: f.md5Checksum ?? f.modifiedTime ?? "", size: Number(f.size ?? 0), mtime: msOf(f.modifiedTime) });
        }
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }
}
