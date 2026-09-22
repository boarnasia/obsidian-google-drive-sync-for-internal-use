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
  unsorted: [],
  blocked: [],
  deleteLimit: 10,
  ...over,
});

/** ビューが触るぶんだけのプラグイン。 */
function fakePlugin(over: { plan?: SyncPlan; ready?: boolean; connected?: boolean } = {}) {
  return {
    settings: { lastSyncAt: null, autoSync: true },
    controller: {
      connected: over.connected ?? true,
      ready: over.ready ?? true,
      plan: vi.fn(async () => over.plan ?? plan()),
      shareLocalFiles: vi.fn(async (_paths: readonly string[]) => emptyReport()),
      trashLocalFiles: vi.fn(async (paths: readonly string[]) => ({ trashed: [...paths], errors: [] as string[] })),
    },
    runSync: vi.fn(async (_opts?: { approvedDeletes?: ReadonlySet<string> }) => undefined),
    runClone: vi.fn(async () => emptyReport()),
    cancelClone: vi.fn(),
    cloneProgress: null,
    cloneRemainingMs: () => null,
    onCloneProgress: () => () => undefined,
    setAutoSync: vi.fn(async (_on: boolean) => undefined),
  };
}

/** テストが触る面。private をまたぐので、交差型ではなく構造で受ける。 */
interface Panel {
  refresh(): Promise<void>;
  plan: SyncPlan | null;
  approved: Set<string>;
  heldDeletes(plan: SyncPlan): string[];
  confirmTrashAll(paths: string[]): void;
  runClone(): void;
  approveDeletes(): void;
  share(paths: string[]): void;
  trash(paths: string[]): void;
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
    expect(plugin.runClone).not.toHaveBeenCalled();
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
    plugin = fakePlugin({ plan: plan({ blocked: ["delete-guard"], deleteRemote: ["b.md"] }) });
    const panel = panelOf(plugin);
    panel.approved.add("a.md");
    panel.approved.add("b.md");

    await panel.refresh();

    expect([...panel.approved]).toEqual(["b.md"]);
  });

  it("承認の一覧から消えたら選択も落とす", async () => {
    // 上限に当たっていなければ、この削除は承認を待っていない。
    plugin = fakePlugin({ plan: plan({ deleteRemote: ["b.md"] }) });
    const panel = panelOf(plugin);
    panel.approved.add("b.md");

    await panel.refresh();

    expect(panel.approved.size).toBe(0);
  });
});

/*
 * 承認を求めるのは、安全上限に当たって実際に保留されている削除だけである。
 * 上限内の削除まで並べると、押さなければ消えないように読め、放っておけば
 * 止まっていると誤解させる。
 */
describe("承認を待っている削除", () => {
  const panel = (): Panel => panelOf(fakePlugin());

  it("上限に当たっていれば、両側の削除を並べる", () => {
    const p = plan({ blocked: ["delete-guard"], deleteRemote: ["r.md"], deleteLocal: ["l.md"] });
    expect(panel().heldDeletes(p)).toEqual(["r.md", "l.md"]);
  });

  it("上限内の削除は並べない（承認を待っていない）", () => {
    expect(panel().heldDeletes(plan({ deleteRemote: ["r.md"], deleteLocal: ["l.md"] }))).toEqual([]);
  });

  it("別の理由で止まっているだけなら並べない", () => {
    const p = plan({ blocked: ["vault-empty"], deleteRemote: ["r.md"] });
    expect(panel().heldDeletes(p)).toEqual([]);
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

describe("ローカル固有ファイルの分類", () => {
  it("「共有」は選んだパスだけを渡し、差分を数え直す", async () => {
    plugin = fakePlugin({ plan: plan({ localOnly: ["a.md", "b.md"], unsorted: ["a.md", "b.md"] }) });
    const panel = panelOf(plugin);
    await panel.refresh();

    panel.share(["a.md"]);
    await vi.waitFor(() => expect(plugin.controller.shareLocalFiles).toHaveBeenCalledWith(["a.md"]));
    await vi.waitFor(() => expect(plugin.controller.plan).toHaveBeenCalledTimes(2));
  });

  it("「削除」はローカルだけを消し、同期を走らせない", async () => {
    plugin = fakePlugin({ plan: plan({ localOnly: ["a.md"], unsorted: ["a.md"] }) });
    const panel = panelOf(plugin);
    await panel.refresh();

    panel.trash(["a.md"]);
    await vi.waitFor(() => expect(plugin.controller.trashLocalFiles).toHaveBeenCalledWith(["a.md"]));
    expect(plugin.runSync).not.toHaveBeenCalled();
  });

  it("一括削除は、確認を挟むまで何も消さない", async () => {
    plugin = fakePlugin({ plan: plan({ localOnly: ["a.md"], unsorted: ["a.md"] }) });
    const panel = panelOf(plugin);
    await panel.refresh();

    panel.confirmTrashAll(["a.md"]);

    expect(plugin.controller.trashLocalFiles).not.toHaveBeenCalled();
  });
});

describe("clone", () => {
  it("止まっていても実行できる（これが抜け道）", async () => {
    plugin = fakePlugin({ plan: plan({ blocked: ["vault-empty"], deleteRemote: ["a.md"] }) });
    const panel = panelOf(plugin);
    await panel.refresh();

    panel.runClone();
    await vi.waitFor(() => expect(plugin.runClone).toHaveBeenCalled());
  });

  it("clone の後は差分を数え直す", async () => {
    const panel = panelOf(plugin);
    await panel.refresh();

    panel.runClone();
    await vi.waitFor(() => expect(plugin.controller.plan).toHaveBeenCalledTimes(2));
  });
});
