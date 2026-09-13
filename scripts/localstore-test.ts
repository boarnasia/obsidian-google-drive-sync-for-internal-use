/*
 * ObsidianLocalStore のオフラインテスト。ネットワークも Obsidian 本体も使わない。
 * 見ているのは二つ: マウントポイントの変換が正しいことと、書き込みの境界が
 * 読み取りの境界と一致していること。
 * 実行: sh scripts/run-pilot.sh scripts/localstore-test.ts
 */
import { App } from "obsidian";
import { ObsidianLocalStore } from "../src/obsidian/ObsidianLocalStore";
import { FakeVault, appWith } from "./_fake-vault";

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

const enc = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer;

function store(vault: FakeVault, mount: string): ObsidianLocalStore {
  return new ObsidianLocalStore(appWith(vault) as unknown as App, mount);
}

async function threw(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

async function main(): Promise<void> {
  // ------------------------------------------------- マウント = Vault 全体
  {
    const v = new FakeVault();
    v.seed("顧客/A社.md", "a");
    v.seed("日報/2026-09-12.md", "b");
    v.seed(".obsidian/plugins/x/data.json", "secret");
    const list = await store(v, "").list();
    const paths = list.map((f) => f.path).sort();

    check("Vault 全体では全ファイルがマウント相対（＝Vault 相対）で出る", paths.join("|") === "日報/2026-09-12.md|顧客/A社.md");
    check("設定ディレクトリは同期対象に入らない", !paths.some((p) => p.startsWith(".obsidian")));
    check("Vault 全体のときは getFiles を公然と呼ぶ", v.getFilesCalls === 1);
    check("内容のハッシュが取れている", list.every((f) => f.hash.length === 64));
  }

  // ------------------------------------------- マウント = 部分木（本命の変換）
  {
    const v = new FakeVault();
    v.seed("個人メモ/日記.md", "private");
    v.seed("仕事/顧客/A社.md", "a");
    v.seed("仕事/日報/2026-09-12.md", "b");
    const s = store(v, "仕事");
    const paths = (await s.list()).map((f) => f.path).sort();

    check("マウント配下だけが出る", paths.join("|") === "日報/2026-09-12.md|顧客/A社.md");
    check("マウントのフォルダ名はパスに現れない", !paths.some((p) => p.startsWith("仕事")));
    check("マウント指定時は Vault 全体を列挙しない", v.getFilesCalls === 0);
    check("マウント外のファイルは読みにすら行かない", !v.readPaths.some((p) => p.startsWith("個人メモ")));

    check("読み取りはマウント相対のパスで通る", new TextDecoder().decode(await s.read("顧客/A社.md")) === "a");
  }

  // ------------------------------------------------------- 存在しないマウント
  {
    const v = new FakeVault();
    v.seed("顧客/A社.md", "a");
    const paths = (await store(v, "存在しない").list()).map((f) => f.path);
    check("存在しないマウントは同期対象ゼロ（Vault 全体に広がらない）", paths.length === 0);
    check("そのとき getFiles も呼ばない", v.getFilesCalls === 0);
  }

  // ------------------------------------------------------------ 書き込み
  {
    const v = new FakeVault();
    v.seed("仕事/顧客/A社.md", "old");
    const s = store(v, "仕事");

    await s.write("顧客/A社.md", enc("new"));
    check("既存ファイルは modifyBinary で置き換わる（エディタが追従する経路）", v.contentOf("仕事/顧客/A社.md") === "new");

    await s.write("議事録/2026/09/12.md", enc("x"));
    check("新規ファイルは作られる", v.contentOf("仕事/議事録/2026/09/12.md") === "x");
    check("祖先フォルダが順に作られる", v.getFolderByPath("仕事/議事録/2026") !== null);

    check("書き込みもマウント配下に落ちる", v.getFileByPath("議事録/2026/09/12.md") === null);
  }

  // --------------------------------------------------- 書き込みの境界（要点）
  // 読み取り側は設定ディレクトリを除外しているのに書き込み側が素通しだと、リモートが
  // 返したパスで .obsidian/plugins/… に書ける。両側を同じ関数で決めていることを確かめる。
  {
    const v = new FakeVault();
    v.seed("仕事/a.md", "a");
    const s = store(v, "仕事");

    check(
      "マウントの外へは書けない（親への脱出）",
      (await threw(() => s.write("../個人メモ/盗んだ.md", enc("x"))))?.includes("unsafe path") === true
    );
    check("実際に書かれていない", v.getFileByPath("個人メモ/盗んだ.md") === null);

    const whole = store(v, "");
    check(
      "Vault 全体でも設定ディレクトリには書けない",
      (await threw(() => whole.write(".obsidian/plugins/evil/main.js", enc("x")))) !== null
    );
    check("プラグインが仕込まれていない", v.getFileByPath(".obsidian/plugins/evil/main.js") === null);

    check("削除も同じ境界で止まる", (await threw(() => whole.delete(".obsidian/plugins/x/data.json"))) !== null);
  }

  // -------------------------------------------------------------- 削除
  {
    const v = new FakeVault();
    v.seed("仕事/消す.md", "x");
    const s = store(v, "仕事");

    await s.delete("消す.md");
    check("削除は OS のゴミ箱へ（完全削除しない）", v.trashed.length === 1 && v.trashed[0].system === true);
    check("Vault から消えている", v.getFileByPath("仕事/消す.md") === null);

    await s.delete("もう無い.md");
    check("存在しないファイルの削除は何もしない", v.trashed.length === 1);
  }
  {
    const v = new FakeVault();
    v.systemTrashBroken = true;
    v.seed("仕事/消す.md", "x");
    await store(v, "仕事").delete("消す.md");
    check("OS のゴミ箱が使えなければ Vault 内の .trash に落ちる", v.trashed.length === 1 && v.trashed[0].system === false);
  }

  console.log(`\n=== localstore: ${failed === 0 ? "ALL PASS" : failed + " FAILED"} (${passed} passed) ===`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error("localstore-test crashed:", (e as Error).message);
  process.exitCode = 1;
});
