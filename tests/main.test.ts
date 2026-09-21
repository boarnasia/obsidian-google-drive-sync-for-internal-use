/*
 * プラグインの読み込み経路をヘッドレスで走らせる。`obsidian` はモックに差し替わる。
 *
 * 見ているのは「機能が正しいか」ではなく「起動して、設定画面が組み上がり、設定の
 * 読み書きが噛み合っているか」——壊れると誰も設定画面に辿り着けなくなる層である。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import GoogleDriveSyncPlugin from "../src/main";
import { DEFAULT_SETTINGS, Settings } from "../src/settings";
import { en, ja, setLanguage, t } from "../src/i18n";
import type { App as ObsidianApp } from "obsidian";
import { App, MockSettingDefinition } from "./helpers/obsidian-mock";

/** manifest.json の最小形（プラグインは値を読まないが、型が要求する）。 */
const MANIFEST = {
  id: "google-drive-sync-for-internal-use",
  name: "Google Drive Sync (Internal Use)",
  author: "Masato Uehara",
  version: "0.1.0",
  minAppVersion: "1.13.0",
  description: "test",
};

interface Tab {
  getSettingDefinitions(): MockSettingDefinition[];
  getControlValue(key: string): unknown;
  setControlValue(key: string, value: unknown): void | Promise<void>;
}

/** モックが記録する、プラグインが Obsidian に登録したもの。 */
interface Registered {
  _commands: { id: string }[];
  _ribbons: unknown[];
  _views: { type: string }[];
  _settingTabs: Tab[];
  saveData(d: unknown): Promise<void>;
}

type Loaded = GoogleDriveSyncPlugin & Registered;

/**
 * 起動した plugin は必ず控えておき、毎回 onunload する。自動同期が既定で有効な
 * ため、解除しないとポーリングの interval が Node のイベントループを掴んだままになる。
 */
let loaded: GoogleDriveSyncPlugin[] = [];

async function loadPlugin(data: Partial<Settings> | null = null): Promise<{ plugin: Loaded; tab: Tab }> {
  const plugin = new GoogleDriveSyncPlugin(new App() as unknown as ObsidianApp, MANIFEST) as unknown as Loaded;
  if (data) await plugin.saveData(data);
  await plugin.onload();
  loaded.push(plugin);
  return { plugin, tab: plugin._settingTabs[0] };
}

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

beforeEach(() => {
  loaded = [];
});

afterEach(() => {
  for (const plugin of loaded) plugin.onunload();
  setLanguage("en");
});

describe("起動", () => {
  it("onload が最後まで通り、入口が揃う", async () => {
    const { plugin } = await loadPlugin();

    expect(plugin._commands.some((c) => c.id === "sync-now")).toBe(true);
    expect(plugin._commands.some((c) => c.id === "open-sync-panel")).toBe(true);
    // 同期の操作は同期管理にしかないので、リボンを挟まず最初から右サイドバーに出す。
    expect(plugin._ribbons).toHaveLength(0);
    expect(plugin._views.some((v) => v.type === "google-drive-sync-panel")).toBe(true);
    expect(plugin._settingTabs).toHaveLength(1);
  });

  it("未設定では同期する準備ができていない", async () => {
    const { plugin } = await loadPlugin();

    expect(plugin.controller.ready).toBe(false);
    expect(plugin.controller.hasOAuthClient).toBe(false);
  });

  it("同期先が無ければ自動同期は静かに何もしない", async () => {
    const { plugin } = await loadPlugin();
    await plugin.runSync({ quiet: true }); // 例外も通知も出さずに戻ること

    expect(plugin.settings.lastSyncAt).toBeNull();
  });
});

describe("設定画面", () => {
  it("設定定義が組み上がる", async () => {
    const { tab } = await loadPlugin();
    expect(flatten(tab.getSettingDefinitions()).length).toBeGreaterThan(0);
  });

  it("束ねられた全コントロールキーが設定に存在する", async () => {
    // コントロールが名前で読み書きする以上、キーが設定に無ければ黙って壊れる。
    const { tab } = await loadPlugin();
    const keys = flatten(tab.getSettingDefinitions())
      .map((i) => i.control?.key)
      .filter((k): k is string => !!k);

    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((k) => !(k in DEFAULT_SETTINGS))).toEqual([]);
  });

  it("同期先・言語の行がある", async () => {
    const { tab } = await loadPlugin();
    const names = flatten(tab.getSettingDefinitions()).map((i) => i.name);

    expect(names).toContain(t.targetUrlName);
    expect(names).toContain(t.languageName);
  });

  it("同期の操作と設定は置かず、同期管理への入口だけを残す", async () => {
    // 同じ設定が二か所にあると、どちらが効くのかが利用者にも分からなくなる。
    const { tab } = await loadPlugin();
    const items = flatten(tab.getSettingDefinitions());
    const names = items.map((i) => i.name);

    expect(names).not.toContain(t.autoSyncName);
    expect(names).not.toContain(t.pollName);
    expect(names).toContain(t.panelOpen);
  });

  it.each([
    ["E2EE", /passphrase|パスフレーズ|encrypt|暗号化/i],
    ["バケットや HMAC", /bucket|hmac|バケット/i],
    ["Drive スコープの選択", /scope|スコープ/i],
  ])("%s の行は存在しない（一度外したものが復活していない）", async (_label, pattern) => {
    const { tab } = await loadPlugin();
    const names = flatten(tab.getSettingDefinitions())
      .map((i) => i.name ?? "")
      .join("|");

    expect(names).not.toMatch(pattern);
  });
});

describe("設定の読み書き", () => {
  it("テキストは前後の空白を落として保存する", async () => {
    const { plugin, tab } = await loadPlugin();
    await tab.setControlValue("targetUrl", "  https://drive.google.com/drive/folders/abc  ");

    expect(plugin.settings.targetUrl).toBe("https://drive.google.com/drive/folders/abc");
  });

  it("自動同期の入切はサイドバーから入る", async () => {
    const { plugin } = await loadPlugin();
    await plugin.setAutoSync(false);

    expect(plugin.settings.autoSync).toBe(false);
  });

  it("間隔は整数として入り、1 未満は無視して前の値を保つ", async () => {
    const { plugin } = await loadPlugin();
    await plugin.setPollMinutes(5);
    expect(plugin.settings.pollMinutes).toBe(5);

    await plugin.setPollMinutes(0);
    expect(plugin.settings.pollMinutes).toBe(5);

    await plugin.setPollMinutes(Number("これは数ではない"));
    expect(plugin.settings.pollMinutes).toBe(5);
  });

  it("読み戻しも同じキーで揃う", async () => {
    const { tab } = await loadPlugin();
    await tab.setControlValue("targetUrl", " https://drive.google.com/drive/folders/abc ");

    expect(tab.getControlValue("targetUrl")).toBe("https://drive.google.com/drive/folders/abc");
  });
});

describe("同期先の反映", () => {
  const URL_A = "https://drive.google.com/drive/folders/aaa";
  const URL_B = "https://drive.google.com/drive/folders/bbb";
  const targetOf = (folderId: string) => ({ folderId, folderName: folderId, driveId: "d", driveName: "D" });

  /** 接続済みにして、問い合わせを差し替える。 */
  async function connectedPlugin(lookup: (url: string) => Promise<ReturnType<typeof targetOf>>) {
    const { plugin, tab } = await loadPlugin({ driveToken: "refresh" });
    plugin.controller.lookupTarget = lookup;
    return { plugin, tab };
  }

  it("URL を問い合わせた結果が同期先になる", async () => {
    const { plugin } = await connectedPlugin(async () => targetOf("aaa"));
    plugin.settings.targetUrl = URL_A;
    await plugin.resolveTarget();

    expect(plugin.settings.target?.folderId).toBe("aaa");
    expect(plugin.targetError).toBeNull();
  });

  it("問い合わせに失敗したら同期先を未設定に戻し、理由を残す", async () => {
    const { plugin } = await connectedPlugin(async () => {
      throw new Error("見つかりません");
    });
    plugin.settings.target = targetOf("old");
    plugin.settings.targetUrl = URL_A;
    await plugin.resolveTarget();

    expect(plugin.settings.target).toBeNull();
    expect(plugin.targetError).toBe("見つかりません");
  });

  it("URL を空にしたら同期先も未設定になる", async () => {
    const { plugin } = await connectedPlugin(async () => targetOf("aaa"));
    plugin.settings.target = targetOf("aaa");
    plugin.settings.targetUrl = "";
    await plugin.resolveTarget();

    expect(plugin.settings.target).toBeNull();
  });

  it("追い越された問い合わせの結果は採らない", async () => {
    let releaseA!: () => void;
    const { plugin } = await connectedPlugin((url) =>
      url === URL_A
        ? new Promise((r) => (releaseA = () => r(targetOf("aaa"))))
        : Promise.resolve(targetOf("bbb"))
    );

    plugin.settings.targetUrl = URL_A;
    const first = plugin.resolveTarget();
    plugin.settings.targetUrl = URL_B;
    await plugin.resolveTarget();
    releaseA();
    await first;

    expect(plugin.settings.target?.folderId).toBe("bbb");
  });

  it("未接続なら問い合わせず、同期先は未設定のまま", async () => {
    const { plugin } = await loadPlugin();
    let called = 0;
    plugin.controller.lookupTarget = async () => {
      called++;
      return targetOf("aaa");
    };
    plugin.settings.targetUrl = URL_A;
    await plugin.resolveTarget();

    expect(called).toBe(0);
    expect(plugin.settings.target).toBeNull();
  });
});

describe("言語", () => {
  it("設定画面から切り替えると文字列が入れ替わる", async () => {
    const { tab } = await loadPlugin();

    await tab.setControlValue("language", "ja");
    expect(t.syncHeading).toBe(ja.syncHeading);

    await tab.setControlValue("language", "en");
    expect(t.syncHeading).toBe(en.syncHeading);
  });

  it("自動は Obsidian の申告に従う（モックは en）", async () => {
    const { tab } = await loadPlugin();
    await tab.setControlValue("language", "auto");

    expect(t.syncHeading).toBe(en.syncHeading);
  });
});

describe("保存済み設定の復元", () => {
  it("保存済みの設定が読み戻り、欠けているキーは既定値で埋まる", async () => {
    const { plugin } = await loadPlugin({ targetUrl: "https://drive.google.com/drive/folders/abc", pollMinutes: 7, language: "ja" });

    expect(plugin.settings.targetUrl).toBe("https://drive.google.com/drive/folders/abc");
    expect(plugin.settings.pollMinutes).toBe(7);
    expect(plugin.settings.autoSync).toBe(DEFAULT_SETTINGS.autoSync);
  });

  it("保存済みの言語が起動時に効く", async () => {
    await loadPlugin({ language: "ja" });
    expect(t.syncHeading).toBe(ja.syncHeading);
  });
});
