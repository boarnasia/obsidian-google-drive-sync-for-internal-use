/*
 * 同期管理サイドバーの判断部分。描画そのもの（DOM）はヘッドレスでは追わず、
 * 「押せるか」「何を承認するか」「数え直しが何も動かさないか」を見る。
 *
 * この画面の存在理由は、止まった同期から抜ける道を出すことである（ADR-0005）。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncPanelView } from "../../src/obsidian/SyncPanelView";
import { SyncPlan, emptyReport } from "../../src/sync/types";

const plan = (over: Partial<SyncPlan> = {}): SyncPlan => ({
  upload: [],
  download: [],
  conflict: [],
  deleteLocal: [],
  deleteRemote: [],
  localOnly: [],
  blocked: [],
  deleteLimit: 10,
  ...over,
});

/** ビューが触るぶんだけのプラグイン。 */
function fakePlugin(over: { plan?: SyncPlan; ready?: boolean; connected?: boolean } = {}) {
  return {
    settings: { lastSyncAt: null },
    controller: {
      connected: over.connected ?? true,
      ready: over.ready ?? true,
      plan: vi.fn(async () => over.plan ?? plan()),
      clone: vi.fn(async () => emptyReport()),
    },
    runSync: vi.fn(async (_opts?: { approvedDeletes?: ReadonlySet<string> }) => undefined),
  };
}

/** テストが触る面。private をまたぐので、交差型ではなく構造で受ける。 */
interface Panel {
  refresh(): Promise<void>;
  plan: SyncPlan | null;
  approved: Set<string>;
  runClone(): void;
  approveDeletes(): void;
}

const panelOf = (plugin: ReturnType<typeof fakePlugin>): Panel =>
  new SyncPanelView({} as never, plugin as never) as unknown as Panel;

let plugin: ReturnType<typeof fakePlugin>;

beforeEach(() => {
  plugin = fakePlugin();
});

describe("数え直し", () => {
  it("差分を取るだけで、同期も clone も呼ばない", async () => {
    const panel = panelOf(plugin);
    await panel.refresh();

    expect(plugin.controller.plan).toHaveBeenCalledTimes(1);
    expect(plugin.runSync).not.toHaveBeenCalled();
    expect(plugin.controller.clone).not.toHaveBeenCalled();
  });

  it("同期先が未設定なら問い合わせない", async () => {
    plugin = fakePlugin({ ready: false });
    const panel = panelOf(plugin);
    await panel.refresh();

    expect(plugin.controller.plan).not.toHaveBeenCalled();
    expect(panel.plan).toBeNull();
  });

  it("失敗しても画面は生き残る（次の更新でやり直せる）", async () => {
    plugin.controller.plan = vi.fn(async () => {
      throw new Error("ネットワークが死んでいる");
    });
    const panel = panelOf(plugin);
    await panel.refresh();

    expect(panel.plan).toBeNull();
  });

  it("対象でなくなった削除の選択は落とす", async () => {
    plugin = fakePlugin({ plan: plan({ deleteRemote: ["b.md"] }) });
    const panel = panelOf(plugin);
    panel.approved.add("a.md");
    panel.approved.add("b.md");

    await panel.refresh();

    expect([...panel.approved]).toEqual(["b.md"]);
  });
});

describe("削除の承認", () => {
  it("選んだパスだけを同期に渡す", async () => {
    plugin = fakePlugin({ plan: plan({ deleteRemote: ["a.md", "b.md"] }) });
    const panel = panelOf(plugin);
    await panel.refresh();
    panel.approved.add("a.md");

    panel.approveDeletes();
    await vi.waitFor(() => expect(plugin.runSync).toHaveBeenCalled());

    const opts = plugin.runSync.mock.calls[0][0];
    expect([...(opts?.approvedDeletes ?? [])]).toEqual(["a.md"]);
  });

  it("承認の後は選択を空に戻す（次の同期に持ち越さない）", async () => {
    plugin = fakePlugin({ plan: plan({ deleteRemote: ["a.md"] }) });
    const panel = panelOf(plugin);
    await panel.refresh();
    panel.approved.add("a.md");

    panel.approveDeletes();
    await vi.waitFor(() => expect(plugin.runSync).toHaveBeenCalled());

    expect(panel.approved.size).toBe(0);
  });
});

describe("clone", () => {
  it("止まっていても実行できる（これが抜け道）", async () => {
    plugin = fakePlugin({ plan: plan({ blocked: ["vault-empty"], deleteRemote: ["a.md"] }) });
    const panel = panelOf(plugin);
    await panel.refresh();

    panel.runClone();
    await vi.waitFor(() => expect(plugin.controller.clone).toHaveBeenCalled());
  });

  it("clone の後は差分を数え直す", async () => {
    const panel = panelOf(plugin);
    await panel.refresh();

    panel.runClone();
    await vi.waitFor(() => expect(plugin.controller.plan).toHaveBeenCalledTimes(2));
  });
});
