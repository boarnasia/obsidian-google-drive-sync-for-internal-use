/*
 * Drive API v3 のインメモリな偽物。ネットワークにも資格情報にも触れない。
 *
 * 目的は二つある。ひとつは往復の検証——put したものが list に現れ、delete した
 * ものが消えること。もうひとつは「実際に何を送っているか」の記録である。共有
 * ドライブは利用者の既定のコーパスに入らないため、corpora/driveId/
 * includeItemsFromAllDrives を欠いた files.list は *空の結果で成功する*。同期
 * エンジンはそれを「リモートから全ファイルが消えた」と読む。その静かな失敗は
 * URL を見ていないと捕まえられない。
 */
import { HttpResponse, HttpSend } from "../../src/providers/RemoteProvider";

export const FOLDER_MIME = "application/vnd.google-apps.folder";

const enc = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer as ArrayBuffer;
const dec = (b: ArrayBuffer): string => new TextDecoder().decode(b);

interface Entry {
  id: string;
  name: string;
  parent: string;
  mimeType: string;
  content: string;
  modifiedTime: string;
  trashed: boolean;
}

export interface Request {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: ArrayBuffer;
}

const ok = (body: string): HttpResponse => ({
  status: 200,
  headers: {},
  arrayBuffer: async () => enc(body),
  text: async () => body,
});

const fail = (status: number, body = ""): HttpResponse => ({
  status,
  headers: {},
  arrayBuffer: async () => enc(body),
  text: async () => body,
});

export class FakeDrive {
  readonly requests: Request[] = [];
  private readonly entries = new Map<string, Entry>();
  private seq = 0;
  private clock = 0;

  constructor(
    readonly rootId: string,
    /** 1 ページに入る件数。小さくするとページングの経路を通せる。 */
    private readonly pageSize = 1000
  ) {}

  // ------------------------------------------------------------------ 準備

  /** 同期ルート相対のパスにファイルを置く（途中のフォルダは作る）。 */
  seed(path: string, content: string): string {
    const segs = path.split("/");
    const name = segs.pop() as string;
    let parent = this.rootId;
    for (const seg of segs) parent = this.folder(seg, parent);
    return this.add(name, parent, "text/markdown", content).id;
  }

  private folder(name: string, parent: string): string {
    const existing = [...this.entries.values()].find(
      (e) => e.parent === parent && e.name === name && e.mimeType === FOLDER_MIME && !e.trashed
    );
    return existing ? existing.id : this.add(name, parent, FOLDER_MIME, "").id;
  }

  private add(name: string, parent: string, mimeType: string, content: string): Entry {
    const e: Entry = {
      id: `id-${++this.seq}`,
      name,
      parent,
      mimeType,
      content,
      modifiedTime: new Date(Date.UTC(2026, 1, 3, 0, 0, ++this.clock)).toISOString(),
      trashed: false,
    };
    this.entries.set(e.id, e);
    return e;
  }

  // ------------------------------------------------------------ テスト用の目

  /** 同期ルートからの相対パス → 内容。ゴミ箱のものは含まない。 */
  contents(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const e of this.entries.values()) {
      if (e.trashed || e.mimeType === FOLDER_MIME) continue;
      out[this.pathOf(e)] = e.content;
    }
    return out;
  }

  /** 他の誰かが完全に消した状態を作る（ID が無効になる）。 */
  hardDelete(path: string): void {
    for (const [id, e] of this.entries) if (this.pathOf(e) === path) this.entries.delete(id);
  }

  /** そのパスにあるフォルダの数。並列書き込みで二重に作っていないかを見る。 */
  folderCount(path: string): number {
    return [...this.entries.values()].filter(
      (e) => e.mimeType === FOLDER_MIME && !e.trashed && this.pathOf(e) === path
    ).length;
  }

  trashedPaths(): string[] {
    return [...this.entries.values()].filter((e) => e.trashed).map((e) => e.name);
  }

  private pathOf(e: Entry): string {
    const parts = [e.name];
    let cur = this.entries.get(e.parent);
    while (cur) {
      parts.unshift(cur.name);
      cur = this.entries.get(cur.parent);
    }
    return parts.join("/");
  }

  /** 記録したリクエストを `"GET <url>"` の形で返す。 */
  urls(): string[] {
    return this.requests.map((r) => `${r.method} ${r.url}`);
  }

  listUrls(): string[] {
    return this.urls().filter((u) => u.startsWith("GET ") && u.includes("/files?q="));
  }

  // ---------------------------------------------------------------- 通信の口

  /** 1 リクエストあたりの遅延（ms）。往復が直列か並列かを測るために使う。 */
  delayMs = 0;

  readonly http: HttpSend = async (method, url, headers, body) => {
    this.requests.push({ method, url, headers, body });
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    const u = new URL(url);

    if (method === "GET" && u.pathname.endsWith("/files") && u.searchParams.has("q")) {
      return ok(JSON.stringify(this.query(u)));
    }
    if (method === "GET" && u.searchParams.get("alt") === "media") {
      const e = this.entries.get(u.pathname.split("/").pop() as string);
      return e ? ok(e.content) : fail(404, "not found");
    }
    if (method === "POST" && u.pathname.endsWith("/files")) {
      const meta = JSON.parse(dec(body as ArrayBuffer)) as { name: string; parents: string[]; mimeType?: string };
      const e = this.add(meta.name, meta.parents[0], meta.mimeType ?? "application/octet-stream", "");
      return ok(JSON.stringify({ id: e.id }));
    }
    if (method === "PATCH" && u.searchParams.get("uploadType") === "media") {
      const e = this.entries.get(u.pathname.split("/").pop() as string);
      if (!e) return fail(404, "not found");
      e.content = dec(body as ArrayBuffer);
      e.modifiedTime = new Date(Date.UTC(2026, 1, 3, 0, 0, ++this.clock)).toISOString();
      return ok(JSON.stringify({ md5Checksum: md5(e.content), modifiedTime: e.modifiedTime }));
    }
    if (method === "PATCH") {
      const e = this.entries.get(u.pathname.split("/").pop() as string);
      if (!e) return fail(404, "not found");
      const patch = JSON.parse(dec(body as ArrayBuffer)) as { trashed?: boolean };
      if (patch.trashed) e.trashed = true;
      return ok(JSON.stringify({ id: e.id }));
    }
    return fail(400, `unexpected ${method} ${url}`);
  };

  /**
   * `q` を読んで子を返す。Drive と同じく **共有ドライブを名指ししない問い合わせは
   * マイドライブしか見ない**——このテストでは同期ルートが共有ドライブ上にある
   * 設定のとき、パラメータを欠いた list には空を返して、その静かな失敗を再現する。
   */
  private query(u: URL): { files: unknown[]; nextPageToken?: string } {
    const q = u.searchParams.get("q") as string;
    if (this.sharedDrive && !u.searchParams.has("driveId")) return { files: [] };

    const parent = /'([^']+)' in parents/.exec(q)?.[1] ?? "";
    const name = /name='((?:[^'\\]|\\.)*)'/.exec(q)?.[1]?.replace(/\\(.)/g, "$1");
    const foldersOnly = q.includes(`mimeType='${FOLDER_MIME}'`);
    const filesOnly = q.includes(`mimeType!='${FOLDER_MIME}'`);

    let hits = [...this.entries.values()].filter(
      (e) =>
        e.parent === parent &&
        !e.trashed &&
        (name === undefined || e.name === name) &&
        (!foldersOnly || e.mimeType === FOLDER_MIME) &&
        (!filesOnly || e.mimeType !== FOLDER_MIME)
    );

    const start = Number(u.searchParams.get("pageToken") ?? 0);
    const page = hits.slice(start, start + this.pageSize);
    const next = start + this.pageSize < hits.length ? String(start + this.pageSize) : undefined;

    return {
      files: page.map((e) => ({
        id: e.id,
        name: e.name,
        mimeType: e.mimeType,
        modifiedTime: e.modifiedTime,
        ...(e.mimeType === FOLDER_MIME ? {} : { md5Checksum: md5(e.content), size: String(e.content.length) }),
      })),
      ...(next ? { nextPageToken: next } : {}),
    };
  }

  /** true にすると、共有ドライブを名指ししない list に空を返す。 */
  sharedDrive = false;
}

/** 内容から決まる版。本物の MD5 である必要は無く、内容が一対一で写れば足りる。 */
function md5(content: string): string {
  let h = 0;
  for (let i = 0; i < content.length; i++) h = (Math.imul(h, 31) + content.charCodeAt(i)) | 0;
  return `md5-${(h >>> 0).toString(16)}-${content.length}`;
}
