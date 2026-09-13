/*
 * プラグインの読み込み経路をヘッドレスで走らせるスモークテスト。obsidian モジュールは
 * モックに差し替える。ネットワークも Obsidian 本体も要らない。
 *
 * 見ているのは「機能が正しいか」ではなく「起動して、設定画面が組み上がり、
 * 設定の読み書きが噛み合っているか」——壊れると誰も設定画面に辿り着けなくなる層。
 * 実行: sh scripts/run-pilot.sh scripts/obsidian-smoke.ts
 */
import { App, MockSettingDefinition } from "./_mock-obsidian";
import GoogleDriveSyncPlugin from "../src/main";
import { DEFAULT_SETTINGS, Settings } from "../src/settings";
import { en, ja, t } from "../src/i18n";

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

type Tab = {
  getSettingDefinitions(): MockSettingDefinition[];
  getControlValue(key: string): unknown;
  setControlValue(key: string, value: unknown): void | Promise<void>;
};

/** 定義ツリーを平らにする（group / page は items を持つ）。 */
function flatten(items: MockSettingDefinition[]): MockSettingDefinition[] {
  const out: MockSettingDefinition[] = [];
  const visit = (list: MockSettingDefinition[]): void => {
    for (const item of list) {
      out.push(item);
      if (item.items) visit(item.items);
    }
  };
  visit(items);
  return out;
}

/**
 * 起動した plugin は必ず控えておき、最後に onunload する。自動同期が既定で有効な
 * ため、解除しないとポーリングの interval が Node のイベントループを掴んだままになり、
 * テストが終わらない（Obsidian 側では onunload がこれを解除する）。
 */
const loaded: GoogleDriveSyncPlugin[] = [];

async function loadPlugin(data: Partial<Settings> | null = null): Promise<{ plugin: GoogleDriveSyncPlugin; tab: Tab }> {
  const plugin = new GoogleDriveSyncPlugin(new App(), {}) as unknown as GoogleDriveSyncPlugin & {
    _commands: { id: string }[];
    _ribbons: unknown[];
    _settingTabs: unknown[];
    saveData(d: unknown): Promise<void>;
  };
  if (data) await plugin.saveData(data);
  await plugin.onload();
  loaded.push(plugin);
  return { plugin, tab: (plugin as unknown as { _settingTabs: Tab[] })._settingTabs[0] };
}

async function main(): Promise<void> {
  // ---------------------------------------------------------------- 起動
  {
    const { plugin } = await loadPlugin();
    const p = plugin as unknown as { _commands: { id: string }[]; _ribbons: unknown[]; _settingTabs: unknown[] };
    check("onload が最後まで通る", true);
    check("sync-now コマンドが登録される", p._commands.some((c) => c.id === "sync-now"));
    check("リボンのアイコンが登録される", p._ribbons.length === 1);
    check("設定タブが登録される", p._settingTabs.length === 1);
    check("未設定では ready にならない", plugin.controller.ready === false);
    check("未設定では OAuth クライアントも未設定", plugin.controller.hasOAuthClient === false);
  }

  // ------------------------------------------------------------ 設定画面
  {
    const { plugin, tab } = await loadPlugin();
    const items = flatten(tab.getSettingDefinitions());
    check("設定定義が組み上がる", items.length > 0);

    // コントロールが名前で読み書きする以上、キーが設定に無ければ黙って壊れる。
    const keys = items.map((i) => i.control?.key).filter((k): k is string => !!k);
    const missing = keys.filter((k) => !(k in DEFAULT_SETTINGS));
    check(`束ねられた全コントロールキーが設定に存在する（${keys.length} 個）`, missing.length === 0);
    if (missing.length) console.log("        見つからないキー:", missing.join(", "));

    check("同期先の行がある", items.some((i) => i.name === t.targetUrlName));
    check("マウントの行がある", items.some((i) => i.name === t.mountName));
    check("言語の行がある", items.some((i) => i.name === t.languageName));

    // 削除したはずのものが復活していないこと。
    const names = items.map((i) => i.name ?? "").join("|");
    check("E2EE の行は存在しない", !/passphrase|パスフレーズ|encrypt|暗号化/i.test(names));
    check("バケットや HMAC の行は存在しない", !/bucket|hmac|バケット/i.test(names));
    check("Drive スコープの選択肢は存在しない", !/scope|スコープ/i.test(names));
  }

  // ------------------------------------------------------ 設定の読み書き
  {
    const { plugin, tab } = await loadPlugin();
    await tab.setControlValue("targetUrl", "  https://drive.google.com/drive/folders/abc  ");
    check("テキストは前後の空白を落として保存する", plugin.settings.targetUrl === "https://drive.google.com/drive/folders/abc");

    await tab.setControlValue("mountFolder", " 仕事 ");
    check("マウントフォルダも同じ", plugin.settings.mountFolder === "仕事");

    await tab.setControlValue("autoSync", false);
    check("トグルは真偽値として入る", plugin.settings.autoSync === false);

    await tab.setControlValue("pollMinutes", 5);
    check("数値は整数に丸めて入る", plugin.settings.pollMinutes === 5);
    await tab.setControlValue("pollMinutes", 0);
    check("0 以下は無視して前の値を保つ", plugin.settings.pollMinutes === 5);

    check("読み戻しも同じキーで揃う", tab.getControlValue("mountFolder") === "仕事");
  }

  // ---------------------------------------------------------------- 言語
  {
    const { tab } = await loadPlugin();
    await tab.setControlValue("language", "ja");
    check("言語を日本語にすると文字列が入れ替わる", t.syncHeading === ja.syncHeading);
    await tab.setControlValue("language", "en");
    check("英語にも戻せる", t.syncHeading === en.syncHeading);
    await tab.setControlValue("language", "auto");
    check("自動は Obsidian の申告に従う（モックは en）", t.syncHeading === en.syncHeading);
  }

  // ------------------------------------------------------ 保存済み設定の復元
  {
    const { plugin } = await loadPlugin({ mountFolder: "仕事", pollMinutes: 7, language: "ja" });
    check("保存済みの設定が読み戻る", plugin.settings.mountFolder === "仕事" && plugin.settings.pollMinutes === 7);
    check("欠けているキーは既定値で埋まる", plugin.settings.autoSync === DEFAULT_SETTINGS.autoSync);
    check("保存済みの言語が起動時に効く", t.syncHeading === ja.syncHeading);
  }

  // ------------------------------------------- 未設定での自動同期は黙って見送る
  {
    const { plugin } = await loadPlugin();
    await plugin.runSync({ quiet: true }); // 例外も通知も出さずに戻ること
    check("同期先が無ければ自動同期は静かに何もしない", plugin.settings.lastSyncAt === null);
  }

  for (const plugin of loaded) plugin.onunload();

  console.log(`\n=== obsidian smoke: ${failed === 0 ? "ALL PASS" : failed + " FAILED"} (${passed} passed) ===`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error("obsidian-smoke crashed:", (e as Error).message);
  process.exitCode = 1;
});
