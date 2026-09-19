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

  it("マウントポイントの直下が同期ルートの直下に対応する", async () => {
    settings.mountFolder = "仕事";
    vault.seed("仕事/顧客/A社.md", "a");
    vault.seed("個人メモ/日記.md", "private");

    await connected().sync();

    // フォルダ名「仕事」はリモートに現れず、Vault の他の場所は触られない。
    expect(drive.contents()).toEqual({ "顧客/A社.md": "a" });
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

  it("保存したトークンがあり、変更が無ければ同期しない", async () => {
    settings.changeToken[ROOT] = "start-1";
    vault.seed("a.md", "x");

    expect(await connected().syncIfRemoteChanged()).toBeNull();
    expect(drive.contents()).toEqual({}); // 走査すらしていない
  });

  it("変更があれば同期する", async () => {
    settings.changeToken[ROOT] = "start-1";
    changes = [{ fileId: "x" }];
    vault.seed("a.md", "x");

    const report = await connected().syncIfRemoteChanged();
    expect(report?.uploaded).toEqual(["a.md"]);
  });

  it("トークンが無ければ（初回・失効）同期する側に倒れる", async () => {
    vault.seed("a.md", "x");

    const report = await connected().syncIfRemoteChanged();
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

describe("同期先の確認", () => {
  it("未接続では確認しない", async () => {
    await expect(controller().lookupTarget("https://drive.google.com/drive/folders/x")).rejects.toThrow();
  });
});
