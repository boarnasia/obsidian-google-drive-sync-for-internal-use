/*
 * SyncController — 検証済みのコアをプラグインに繋ぐ層。
 *
 * 偽の Vault と偽の Drive を両端に置いて、設定から同期一回分までを通しで動かす。
 * ネットワークにも資格情報にも触れない。
 */
import { App } from "obsidian";
import { beforeEach, describe, expect, it } from "vitest";
import { SyncController } from "../src/SyncController";
import { DEFAULT_SETTINGS, DriveTarget, Settings } from "../src/settings";
import { HttpResponse, HttpSend } from "../src/providers/RemoteProvider";
import { FakeDrive } from "./helpers/fake-drive";
import { FakeVault, appWith } from "./helpers/fake-vault";

const ROOT = "15hqTj0tUn3tpfWeSYca0xcuNlEGDJrvW";
const DRIVE_ID = "0AInotARealSharedDrive";
const TARGET: DriveTarget = { folderId: ROOT, folderName: "営業部Vault", driveId: DRIVE_ID, driveName: "営業部" };

const reply = (body: string, status = 200): HttpResponse => ({
  status,
  headers: {},
  arrayBuffer: async () => new TextEncoder().encode(body).buffer as ArrayBuffer,
  text: async () => body,
});

let vault: FakeVault;
let drive: FakeDrive;
let settings: Settings;
let persisted: number;
/** Changes API が返す「変更あり」の件数。プローブの分岐を試すために差し替える。 */
let changes: unknown[];
let startToken: string;
let tokenRequests: number;
/** 送った順に種類を並べた記録。起点の取得が走査より前であることを見る。 */
let calls: string[];

beforeEach(() => {
  vault = new FakeVault();
  drive = new FakeDrive(ROOT);
  drive.sharedDrive = true;
  settings = structuredClone(DEFAULT_SETTINGS);
  persisted = 0;
  changes = [];
  startToken = "start-1";
  tokenRequests = 0;
  calls = [];
});

/** OAuth と Changes API に答え、それ以外は偽の Drive に流す。 */
const http: HttpSend = async (method, url, headers, body) => {
  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    tokenRequests++;
    return reply(JSON.stringify({ access_token: `at-${tokenRequests}`, expires_in: 3600 }));
  }
  if (url.includes("/changes/startPageToken")) {
    calls.push("startPageToken");
    return reply(JSON.stringify({ startPageToken: startToken }));
  }
  if (url.includes("/changes?")) {
    calls.push("changes");
    return reply(JSON.stringify({ changes }));
  }
  calls.push(url.includes("/files?q=") ? "list" : "drive");
  return drive.http(method, url, headers, body);
};

function controller(): SyncController {
  return new SyncController(appWith(vault) as unknown as App, settings, async () => {
    persisted++;
  }, http);
}

/** 接続済み・同期先確認済みの状態にする。 */
function connected(): SyncController {
  settings.oauthClientId = "cid";
  settings.driveToken = "rt-1";
  settings.target = TARGET;
  return controller();
}

describe("状態", () => {
  it("既定では何も設定されていない", () => {
    const c = controller();
    expect(c.hasOAuthClient).toBe(false);
    expect(c.connected).toBe(false);
    expect(c.ready).toBe(false);
  });

  it("接続しただけでは ready にならない（同期先の確認が要る）", () => {
    settings.oauthClientId = "cid";
    settings.driveToken = "rt-1";
    const c = controller();

    expect(c.connected).toBe(true);
    expect(c.ready).toBe(false);
  });

  it("接続済みかつ同期先が確認済みなら ready", () => {
    expect(connected().ready).toBe(true);
  });

  it("空白だけのクライアント ID は未設定として扱う", () => {
    settings.oauthClientId = "   ";
    expect(controller().hasOAuthClient).toBe(false);
  });
});

describe("準備ができていないときの同期", () => {
  it("未接続なら同期しない", async () => {
    await expect(controller().sync()).rejects.toThrow();
  });

  it("同期先が未設定なら同期しない", async () => {
    settings.oauthClientId = "cid";
    settings.driveToken = "rt-1";
    await expect(controller().sync()).rejects.toThrow();
  });

  it("どちらの場合も Drive に触らない", async () => {
    await controller().sync().catch(() => undefined);
    expect(drive.requests).toEqual([]);
  });
});

describe("同期の一往復", () => {
  it("Vault のファイルが同期ルートに上がる", async () => {
    vault.seed("顧客/A社.md", "a");
    vault.seed("日報/2026-09-12.md", "b");

    const report = await connected().sync();

    expect(report.uploaded.sort()).toEqual(["日報/2026-09-12.md", "顧客/A社.md"]);
    expect(drive.contents()).toEqual({ "顧客/A社.md": "a", "日報/2026-09-12.md": "b" });
  });

  it("リモートのファイルが Vault に降りる", async () => {
    drive.seed("共有/連絡.md", "お知らせ");

    const report = await connected().sync();

    expect(report.downloaded).toEqual(["共有/連絡.md"]);
    expect(vault.contentOf("共有/連絡.md")).toBe("お知らせ");
  });

  it("二度目の同期は何もしない", async () => {
    vault.seed("a.md", "x");
    const c = connected();
    await c.sync();

    const report = await c.sync();
    expect(report.uploaded).toEqual([]);
    expect(report.downloaded).toEqual([]);
  });

  it("ベースラインと最終同期時刻を保存する", async () => {
    vault.seed("a.md", "x");
    await connected().sync();

    expect(Object.keys(settings.syncState[ROOT])).toEqual(["a.md"]);
    expect(settings.lastSyncAt).toBeTypeOf("number");
    expect(persisted).toBe(1);
  });

  it("ベースラインは同期ルートごとに分かれる", async () => {
    // 同期先を変えたら空から始まる。古いベースラインを新しい場所に当てると
    // 全削除と解釈される（ADR-0004）。
    settings.syncState["別のフォルダ"] = { "a.md": { localHash: "h", remoteVersion: "v" } };
    vault.seed("a.md", "x");

    await connected().sync();

    expect(settings.syncState["別のフォルダ"]).toEqual({ "a.md": { localHash: "h", remoteVersion: "v" } });
    expect(settings.syncState[ROOT]["a.md"]).toBeDefined();
  });
});

describe("変更プローブ", () => {
  it("起点トークンは走査の前に取る（走査中の変更を見落とさない）", async () => {
    vault.seed("a.md", "x");
    await connected().sync();

    // 後から取ると、走査のあいだに入った変更を次回のプローブが見落とす。
    expect(calls.indexOf("startPageToken")).toBeLessThan(calls.indexOf("list"));
    expect(settings.changeToken[ROOT]).toBe("start-1");
  });

  it("ローカルにもリモートにも変更が無ければ同期しない", async () => {
    vault.seed("a.md", "x");
    const c = connected();
    await c.sync();
    calls = [];

    expect(await c.syncIfChanged()).toBeNull();
    expect(calls).not.toContain("list"); // 走査すらしていない
  });

  it("変更イベントを取りこぼしたローカルの編集も、リモートの変更を待たずに上げる", async () => {
    vault.seed("a.md", "x");
    const c = connected();
    await c.sync();

    vault.seed("a.md", "x2", 99); // イベントを通さずに書き換わった
    const report = await c.syncIfChanged();

    expect(report?.uploaded).toEqual(["a.md"]);
    expect(calls).not.toContain("changes"); // リモートに問い合わせるまでもない
  });

  it("消えたローカルのファイルも変更として拾う", async () => {
    vault.seed("a.md", "x");
    vault.seed("b.md", "y");
    const c = connected();
    await c.sync();

    await vault.trash(vault.getFileByPath("b.md")!, true);
    const report = await c.syncIfChanged();

    expect(report?.deletedRemote).toEqual(["b.md"]);
  });

  it("分類待ちのファイルだけでは同期しない（上げないと決まっている）", async () => {
    vault.seed("a.md", "x");
    const c = connected();
    await c.sync();

    vault.seed("私のメモ.md", "私的");
    settings.unsorted[ROOT] = ["私のメモ.md"];

    expect(await c.syncIfChanged()).toBeNull();
  });

  it("直近の同期が止まったなら、ローカルの差分だけでは同期し直さない", async () => {
    vault.seed("a.md", "x");
    drive.seed("b.md", "y");
    const c = connected();
    expect((await c.sync()).blocked).toEqual(["no-baseline"]);

    expect(await c.syncIfChanged()).toBeNull();
  });

  it("変更があれば同期する", async () => {
    settings.changeToken[ROOT] = "start-1";
    changes = [{ fileId: "x" }];
    vault.seed("a.md", "x");

    const report = await connected().syncIfChanged();
    expect(report?.uploaded).toEqual(["a.md"]);
  });

  it("トークンが無ければ（初回・失効）同期する側に倒れる", async () => {
    vault.seed("a.md", "x");

    const report = await connected().syncIfChanged();
    expect(report?.uploaded).toEqual(["a.md"]);
  });

  it("同期のたびに起点を取り直す", async () => {
    vault.seed("a.md", "x");
    const c = connected();
    await c.sync();

    startToken = "start-2";
    await c.sync();

    expect(settings.changeToken[ROOT]).toBe("start-2");
  });
});

describe("自分の書き込みの見分け", () => {
  /** 本物と同じく書き込みの最中に届くイベントのうち、自分の書き込みと見分けられなかったもの。 */
  function watch(c: SyncController): string[] {
    const foreign: string[] = [];
    vault.onChange = (_type, path) => {
      if (!c.consumeOwnWrite(path)) foreign.push(path);
    };
    return foreign;
  }

  it("ダウンロードのイベントは自分の書き込みとして消し込む（次の同期を呼ばない）", async () => {
    drive.seed("共有/連絡.md", "お知らせ");
    const c = connected();
    const foreign = watch(c);

    await c.sync();

    expect(vault.contentOf("共有/連絡.md")).toBe("お知らせ");
    expect(foreign).toEqual([]);
  });

  it("リモートの削除をローカルに反映したイベントも消し込む", async () => {
    vault.seed("a.md", "x");
    vault.seed("b.md", "y");
    const c = connected();
    await c.sync();
    drive.hardDelete("b.md");
    const foreign = watch(c);

    await c.sync();

    expect(vault.getFileByPath("b.md")).toBeNull();
    expect(foreign).toEqual([]);
  });

  it("消し込まれずに残った控えは、操作の終わりに捨てる", async () => {
    drive.seed("連絡.md", "お知らせ");
    const c = connected();
    await c.sync(); // イベントを誰も受け取らない

    // 残すと、利用者の次の編集が自分の書き込みとして吸い込まれ、上がらなくなる。
    expect(c.consumeOwnWrite("連絡.md")).toBe(false);
  });
});

describe("アクセストークン", () => {
  it("期限内は使い回す（同期ごとに取り直さない）", async () => {
    vault.seed("a.md", "x");
    vault.seed("b.md", "y");
    await connected().sync();

    expect(tokenRequests).toBe(1);
  });

  it("リフレッシュトークンが無ければ取りに行かない", async () => {
    settings.oauthClientId = "cid";
    settings.target = TARGET;

    await expect(controller().sync()).rejects.toThrow();
    expect(tokenRequests).toBe(0);
  });
});

describe("接続の解除", () => {
  it("リフレッシュトークンを捨てて保存する", async () => {
    const c = connected();
    await c.disconnect();

    expect(settings.driveToken).toBeNull();
    expect(c.connected).toBe(false);
    expect(persisted).toBe(1);
  });

  it("ベースラインは残す（再接続してもやり直しにならない）", async () => {
    vault.seed("a.md", "x");
    const c = connected();
    await c.sync();
    await c.disconnect();

    expect(settings.syncState[ROOT]["a.md"]).toBeDefined();
  });
});

describe("Vault 内の設定ファイル", () => {
  it("clone の後に、無いものだけ作る", async () => {
    drive.seed("a.md", "x");
    const c = connected();

    await c.clone();

    expect(vault.contentOf("_Sync/ignore.md")).toContain("Shared ignore rules");
    expect(vault.contentOf("_Sync/README.md")).toContain("Google Drive Sync");
    expect(vault.contentOf("_SyncLocal/ignore.md")).toBeDefined();
  });

  it("すでにある設定ファイルは上書きしない", async () => {
    vault.seed("_Sync/ignore.md", "# チームの決めごと\n下書き/");
    drive.seed("a.md", "x");

    await connected().clone();

    expect(vault.contentOf("_Sync/ignore.md")).toBe("# チームの決めごと\n下書き/");
  });

  it("clone を通らなければ作らない（有効化しただけの Vault を汚さない）", async () => {
    vault.seed("a.md", "x");

    await connected().sync();

    expect(vault.contentOf("_Sync/README.md")).toBeUndefined();
  });

  it("ローカル固有ファイルは未整理として控える", async () => {
    vault.seed("私のメモ.md", "私的");
    drive.seed("a.md", "x");

    await connected().clone();

    expect(settings.unsorted[ROOT]).toEqual(["私のメモ.md"]);
  });
});

describe("除外規則", () => {
  it("チームの規則に当たるファイルはアップロードしない", async () => {
    vault.seed("_Sync/ignore.md", "下書き/");
    vault.seed("下書き/秘密.md", "私的");
    vault.seed("議事録.md", "共有");

    const report = await connected().sync();

    expect(report.uploaded).not.toContain("下書き/秘密.md");
    expect(Object.keys(drive.contents())).not.toContain("下書き/秘密.md");
    // 規則そのものはチームに配る。除外できてしまうと、以後ルールが届かなくなる。
    expect(report.uploaded).toContain("_Sync/ignore.md");
  });

  it("各自の規則も効く", async () => {
    vault.seed("_SyncLocal/ignore.md", "*.png");
    vault.seed("図.png", "画像");
    vault.seed("議事録.md", "共有");

    const report = await connected().sync();

    expect(report.uploaded).toEqual(["議事録.md"]);
  });

  it("各自の規則ファイルはチームに配らない", async () => {
    vault.seed("_SyncLocal/ignore.md", "# 自分用");
    vault.seed("a.md", "x");

    await connected().sync();

    expect(Object.keys(drive.contents())).toEqual(["a.md"]);
  });
});

describe("ローカル固有ファイルの分類", () => {
  const unsorted = (...paths: string[]): void => {
    settings.unsorted[ROOT] = paths;
  };

  it("「共有」はアップロードし、保留から外れる", async () => {
    vault.seed("私のメモ.md", "私的");
    unsorted("私のメモ.md");

    const report = await connected().shareLocalFiles(["私のメモ.md"]);

    expect(report.uploaded).toContain("私のメモ.md");
    expect(drive.contents()).toHaveProperty("私のメモ.md", "私的");
    expect(settings.unsorted[ROOT]).toEqual([]);
  });

  it("「削除」はローカルのゴミ箱へ送る（リモートには触らない）", async () => {
    vault.seed("いらない.md", "ごみ");
    unsorted("いらない.md");

    const result = await connected().trashLocalFiles(["いらない.md"]);

    expect(result.trashed).toEqual(["いらない.md"]);
    expect(vault.contentOf("いらない.md")).toBeUndefined();
    expect(Object.keys(drive.contents())).toEqual([]);
    expect(settings.unsorted[ROOT]).toEqual([]);
  });

  it("決めていないファイルは、上げも消しもしない", async () => {
    vault.seed("迷い中.md", "未定");
    unsorted("迷い中.md");

    const report = await connected().sync();

    expect(report.heldUploads).toContain("迷い中.md");
    expect(vault.contentOf("迷い中.md")).toBe("未定");
    expect(Object.keys(drive.contents())).toEqual([]);
    expect(settings.unsorted[ROOT]).toEqual(["迷い中.md"]);
  });

  it("未整理が残っていても、他のファイルは上がる", async () => {
    vault.seed("迷い中.md", "未定");
    vault.seed("これも新しい.md", "新規");
    unsorted("迷い中.md");

    const report = await connected().sync();

    expect(report.heldUploads).toContain("迷い中.md");
    expect(Object.keys(drive.contents())).toContain("これも新しい.md");
  });

  it("消えたファイルの保留は、次の同期で落ちる", async () => {
    unsorted("もう無い.md");

    await connected().sync();

    expect(settings.unsorted[ROOT]).toEqual([]);
  });
});

describe("同期先の確認", () => {
  it("未接続では確認しない", async () => {
    await expect(controller().lookupTarget("https://drive.google.com/drive/folders/x")).rejects.toThrow();
  });
});

/*
 * sync・clone・分類は、どれも最後に同じ syncState[folderId] を書く。重なると
 * 後から終わった方が先の結果を丸ごと捨て、ベースラインが両側と食い違う——次の
 * 同期はそれを大量削除として読む。呼び出し元はサイドバー・ポーリング・ファイル
 * 監視と複数あるので、入口ごとではなく SyncController で一本化する。
 */
describe("ベースラインを書く操作は重ならない", () => {
  it("同期中の clone は断る", async () => {
    vault.seed("A.md", "a");
    const c = connected();

    const first = c.sync();
    await expect(c.clone()).rejects.toThrow();
    await first;
  });

  it("clone 中の同期は断る", async () => {
    drive.seed("B.md", "b");
    const c = connected();

    const first = c.clone();
    await expect(c.sync()).rejects.toThrow();
    await first;
  });

  it("同期中の「共有」「削除」も断る", async () => {
    vault.seed("迷い中.md", "未定");
    settings.unsorted[ROOT] = ["迷い中.md"];
    const c = connected();

    const first = c.sync();
    await expect(c.shareLocalFiles(["迷い中.md"])).rejects.toThrow();
    await expect(c.trashLocalFiles(["迷い中.md"])).rejects.toThrow();
    await first;

    // 断られただけで、保留も Vault もそのまま。
    expect(settings.unsorted[ROOT]).toEqual(["迷い中.md"]);
    expect(vault.contentOf("迷い中.md")).toBe("未定");
  });

  it("終わった後は次の操作が通る（鍵が残らない）", async () => {
    vault.seed("A.md", "a");
    const c = connected();

    await c.sync();
    await expect(c.clone()).resolves.toBeDefined();
  });

  it("失敗した操作も鍵を返す", async () => {
    const c = connected();
    settings.target = null;

    await expect(c.sync()).rejects.toThrow();
    settings.target = TARGET;
    await expect(c.sync()).resolves.toBeDefined();
  });

  /** 「共有」は内部で同期まで進む。自分の鍵で自分を締め出さないこと。 */
  it("「共有」は自分の同期で詰まらない", async () => {
    vault.seed("迷い中.md", "決めた");
    settings.unsorted[ROOT] = ["迷い中.md"];

    const report = await connected().shareLocalFiles(["迷い中.md"]);

    expect(report.uploaded).toContain("迷い中.md");
    expect(settings.unsorted[ROOT]).toEqual([]);
  });
});
