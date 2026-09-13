/*
 * Drive 側のオフラインテスト。偽の HttpSend が全リクエスト URL を記録するので、
 * ネットワークにも資格情報にも触れずに「実際に何を送っているか」を確かめられる。
 *
 * ここで見ているのは「動くか」ではなく「動くためのパラメータを送っているか」である。
 * 共有ドライブは利用者の既定のコーパスに入らないため、corpora/driveId/
 * includeItemsFromAllDrives を欠いた files.list は *空の結果で成功する*。同期エンジンは
 * それを「リモートから全ファイルが消えた」と読む。その静かな失敗を止める番人。
 * 実行: sh scripts/run-pilot.sh scripts/drive-test.ts
 */
import { DriveProvider } from "../src/providers/drive/DriveProvider";
import { parseFolderId, resolveDriveTarget } from "../src/providers/drive/DriveTarget";
import { getStartToken, hasChanges } from "../src/providers/drive/ChangeProbe";
import { HttpResponse, HttpSend } from "../src/providers/RemoteProvider";

const FOLDER_ID = "15hqTj0tUn3tpfWeSYca0xcuNlEGDJrvW";
const DRIVE_ID = "0AInotARealSharedDrive";
const enc = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer;

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
  }
}

function reply(body: string): HttpResponse {
  return { status: 200, headers: {}, arrayBuffer: async () => enc(body), text: async () => body };
}

/** リクエストを記録し、プロバイダが先へ進める程度の返事をする。 */
function recorder(): { http: HttpSend; urls: string[] } {
  const urls: string[] = [];
  const http: HttpSend = async (method, url) => {
    urls.push(`${method} ${url}`);
    const body =
      method === "GET" && url.includes("alt=media")
        ? "file-bytes"
        : JSON.stringify({ id: "fid", files: [{ id: "fid", name: "a.md", md5Checksum: "h", size: "1" }] });
    return reply(body);
  };
  return { http, urls };
}

const listCalls = (urls: string[]): string[] => urls.filter((u) => u.startsWith("GET ") && u.includes("/files?q="));
const all = (xs: string[], p: (x: string) => boolean): boolean => xs.length > 0 && xs.every(p);

async function threw(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

async function main(): Promise<void> {
  // ------------------------------------------------ 共有ドライブ上の同期ルート
  {
    const { http, urls } = recorder();
    const p = new DriveProvider({ folderId: FOLDER_ID, driveId: DRIVE_ID }, async () => "tok", http);
    await p.list();
    await p.put("notes/a.md", enc("x"));
    await p.get("notes/a.md");
    await p.delete("notes/a.md");

    const lists = listCalls(urls);
    check("files.list は共有ドライブを名指しする（corpora=drive&driveId）", all(lists, (u) => u.includes("corpora=drive") && u.includes(`driveId=${DRIVE_ID}`)));
    check("files.list は includeItemsFromAllDrives を付ける", all(lists, (u) => u.includes("includeItemsFromAllDrives=true")));
    check("files.list は supportsAllDrives を付ける", all(lists, (u) => u.includes("supportsAllDrives=true")));

    const writes = urls.filter((u) => u.startsWith("POST ") || u.startsWith("PATCH "));
    check("作成・アップロード・ゴミ箱移動も supportsAllDrives を付ける", all(writes, (u) => u.includes("supportsAllDrives=true")));
    check("本文のダウンロードも supportsAllDrives を付ける", urls.some((u) => u.includes("alt=media") && u.includes("supportsAllDrives=true")));

    // ゴミ箱移動の PATCH だけはクエリを持たないので、区切りは "?" でなければならない。
    const trash = urls.find((u) => u.startsWith("PATCH ") && !u.includes("uploadType=media"));
    check("ゴミ箱移動の PATCH のクエリが壊れていない（'?' が一つ、余分な '&' 無し）", !!trash && /\/files\/fid\?supportsAllDrives=true$/.test(trash));

    // 走査は同期ルートから始まる。共有ドライブのルートでも "root" でもない。
    check("走査は指定されたフォルダから始まる", lists.some((u) => u.includes(encodeURIComponent(`'${FOLDER_ID}' in parents`))));
    check("マイドライブのルートを見に行かない", !lists.some((u) => u.includes(encodeURIComponent("'root' in parents"))));
    check("共有ドライブのルートを同期ルートと取り違えない", !lists.some((u) => u.includes(encodeURIComponent(`'${DRIVE_ID}' in parents`))));
  }

  // --------------------------------------------- マイドライブ上の同期ルート
  {
    const { http, urls } = recorder();
    const p = new DriveProvider({ folderId: FOLDER_ID, driveId: "" }, async () => "tok", http);
    await p.list();
    await p.put("notes/a.md", enc("x"));
    await p.delete("notes/a.md");

    check("マイドライブなら共有ドライブ用のパラメータを一切送らない", !urls.some((u) => /supportsAllDrives|includeItemsFromAllDrives|corpora|driveId/.test(u)));
    check("それでも走査は指定されたフォルダから始まる", listCalls(urls).some((u) => u.includes(encodeURIComponent(`'${FOLDER_ID}' in parents`))));
    check("ゴミ箱移動の URL は素のまま", urls.some((u) => /PATCH .*\/files\/fid$/.test(u)));
  }

  // ------------------------------------------------------ 貼られた文字列の解釈
  check("フォルダの URL から ID を取り出す", parseFolderId(`https://drive.google.com/drive/folders/${FOLDER_ID}`) === FOLDER_ID);
  check("共有リンクの ?usp= が付いていても取り出せる", parseFolderId(`https://drive.google.com/drive/folders/${FOLDER_ID}?usp=drive_link`) === FOLDER_ID);
  check("複数アカウント用の /u/0/ 形式も取り出せる", parseFolderId(`https://drive.google.com/drive/u/0/folders/${FOLDER_ID}`) === FOLDER_ID);
  check("末尾のスラッシュは ID に含めない", parseFolderId(`https://drive.google.com/drive/folders/${FOLDER_ID}/`) === FOLDER_ID);
  check("生の ID はそのまま通す", parseFolderId(FOLDER_ID) === FOLDER_ID);
  check("前後の空白は落とす", parseFolderId(`  ${FOLDER_ID}  `) === FOLDER_ID);
  check("空入力は空", parseFolderId("   ") === "");

  // ------------------------------------------------------------ 同期先の確認
  {
    const http: HttpSend = async (_m, url) => {
      if (url.includes("/drives/")) return reply(JSON.stringify({ name: "営業部" }));
      return reply(JSON.stringify({ id: FOLDER_ID, name: "営業部Vault", mimeType: "application/vnd.google-apps.folder", driveId: DRIVE_ID }));
    };
    const target = await resolveDriveTarget(http, async () => "tok", `https://drive.google.com/drive/folders/${FOLDER_ID}?usp=drive_link`);
    check("共有ドライブ内のフォルダと判別できる", target.driveId === DRIVE_ID);
    check("共有ドライブ名を表示用に取得する", target.driveName === "営業部");
    check("フォルダ名を表示用に取得する", target.folderName === "営業部Vault");
  }
  {
    // driveId が無い = マイドライブ。これを黙って通すと、本人だけが同期できて
    // 他の誰にも届かないのに、正常に動いているように見える。
    const http: HttpSend = async () =>
      reply(JSON.stringify({ id: FOLDER_ID, name: "個人メモ", mimeType: "application/vnd.google-apps.folder" }));
    const target = await resolveDriveTarget(http, async () => "tok", FOLDER_ID);
    check("マイドライブのフォルダは driveId 無しとして区別できる", target.driveId === "" && target.driveName === "");
  }
  {
    const http: HttpSend = async () =>
      reply(JSON.stringify({ id: FOLDER_ID, name: "資料.pdf", mimeType: "application/pdf" }));
    check("ファイルの URL を貼ったら止める", await threw(() => resolveDriveTarget(http, async () => "tok", FOLDER_ID)));
  }
  {
    const http: HttpSend = async () => ({ status: 404, headers: {}, arrayBuffer: async () => enc(""), text: async () => "not found" });
    check("見つからないフォルダは失敗として扱う", await threw(() => resolveDriveTarget(http, async () => "tok", FOLDER_ID)));
  }
  {
    const http: HttpSend = async () => reply("{}");
    check("空の入力は Drive に問い合わせる前に止める", await threw(() => resolveDriveTarget(http, async () => "tok", "  ")));
  }

  // -------------------------------------------------------------- 変更プローブ
  {
    const { http, urls } = recorder();
    await getStartToken(http, async () => "tok", DRIVE_ID).catch(() => undefined);
    check("共有ドライブの起点トークンは driveId 付きで取る", urls.some((u) => u.includes("startPageToken") && u.includes(`driveId=${DRIVE_ID}`)));
  }
  {
    const { http, urls } = recorder();
    await getStartToken(http, async () => "tok", "").catch(() => undefined);
    check("マイドライブなら driveId は付けない", urls.some((u) => u.includes("startPageToken") && !u.includes("driveId=")));
  }
  {
    let called = 0;
    const http: HttpSend = async () => {
      called++;
      return reply(JSON.stringify({ changes: [] }));
    };
    check("トークンが無ければ問い合わせずに「変更あり」とみなす", (await hasChanges(http, async () => "tok", "", "")) === true && called === 0);
    check("変更が無ければ false", (await hasChanges(http, async () => "tok", "", "tok-1")) === false);
  }
  {
    const http: HttpSend = async () => reply(JSON.stringify({ changes: [{ fileId: "x" }] }));
    check("変更があれば true", (await hasChanges(http, async () => "tok", "", "tok-1")) === true);
  }
  {
    const { http, urls } = recorder();
    await hasChanges(http, async () => "tok", DRIVE_ID, "tok-1");
    check("変更の問い合わせは 1 件だけ要求する（有無しか要らない）", urls.some((u) => u.includes("pageSize=1")));
  }

  console.log(`\n=== drive: ${failed === 0 ? "ALL PASS" : failed + " FAILED"} (${passed} passed) ===`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error("drive-test crashed:", (e as Error).message);
  process.exitCode = 1;
});
