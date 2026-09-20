/* Minimal mock of the Obsidian plugin API — just enough to RUN the plugin's
 * load path (onload + settings tab + commands) headlessly in Node. Aliased in
 * place of the real `obsidian` module by the smoke test. Not shipped. */
/**
 * プラグインが onload で触る範囲だけの App。`vault.on` が無いと、イベント登録の
 * 時点で落ちてヘッドレス実行そのものが成立しない。
 */
export class App {
  vault: {
    configDir: string;
    on: (...a: unknown[]) => unknown;
    getName: () => string;
  } = {
    configDir: ".obsidian",
    on: () => ({}),
    getName: () => "Test Vault",
  };
  workspace = {
    getActiveFile: () => null,
    getLeavesOfType: (_type: string): unknown[] => [],
    getRightLeaf: (_split: boolean): unknown => null,
    revealLeaf: (_leaf: unknown): void => {},
  };
}
export class Notice {
  constructor(_msg: string) {}
}
export function debounce<T extends (...a: unknown[]) => unknown>(fn: T): T {
  return fn;
}
export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\//, "").replace(/\/$/, "");
}
export async function requestUrl(_o: unknown): Promise<unknown> {
  return { status: 200, headers: {}, arrayBuffer: new ArrayBuffer(0), text: "" };
}

export class Component {
  inputEl: { type: string } = { type: "text" };
  setValue() { return this; }
  setPlaceholder() { return this; }
  setButtonText() { return this; }
  setCta() { return this; }
  addOption() { return this; }
  onChange() { return this; }
  onClick() { return this; }
  setDisabled() { return this; }
  setTooltip() { return this; }
  setWarning() { return this; }
  setDestructive() { return this; }
}

export class Setting {
  settingEl = makeEl();
  infoEl = makeEl();
  descEl = makeEl();
  constructor(_containerEl?: unknown) {}
  setDisabled() { return this; }
  setName() { return this; }
  setDesc() { return this; }
  setHeading() { return this; }
  addText(cb: (c: Component) => void) { cb(new Component()); return this; }
  addToggle(cb: (c: Component) => void) { cb(new Component()); return this; }
  addDropdown(cb: (c: Component) => void) { cb(new Component()); return this; }
  addButton(cb: (c: Component) => void) { cb(new Component()); return this; }
}

export class SettingGroup {}

function makeEl(): Record<string, unknown> {
  return {
    empty() {},
    createEl() { return makeEl(); },
    createDiv() { return makeEl(); },
    createSpan() { return makeEl(); },
    addClass() {},
    removeClass() {},
    addEventListener() {},
    setText() {},
    appendChild() {},
    appendText() {},
    checked: false,
  };
}

/**
 * `createFragment` is an Obsidian *global*, not a module export — plugin code
 * calls it unqualified, so it has to exist on globalThis for the headless run.
 * Installed as a module side effect so every test that aliases `obsidian` to
 * this mock gets it.
 */
(globalThis as unknown as { createFragment: (cb?: (el: unknown) => void) => unknown }).createFragment = (cb) => {
  const frag = makeEl();
  if (cb) cb(frag);
  return frag;
};

/**
 * Obsidian は renderer で動くので、プラグインは `window.setTimeout` /
 * `setInterval` を使う（素の global はポップアウトウィンドウで壊れるため）。
 * Node には window が無いので、ここで最低限を生やす。
 */
{
  const g = globalThis as unknown as { window?: unknown };
  if (!g.window) {
    g.window = {
      setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
      clearTimeout: (id: unknown) => clearTimeout(id as NodeJS.Timeout),
      setInterval: (fn: () => void, ms?: number) => setInterval(fn, ms),
      clearInterval: (id: unknown) => clearInterval(id as NodeJS.Timeout),
      localStorage: { getItem: () => null },
      open: () => undefined,
    };
  }
}

/** A setting definition as the declarative API shapes it (only what tests touch). */
export interface MockSettingDefinition {
  name?: string;
  desc?: unknown;
  heading?: string;
  type?: string;
  visible?: boolean | (() => boolean);
  control?: { type: string; key: string };
  action?: (index: number) => void;
  render?: (setting: Setting, group: SettingGroup) => void | (() => void);
  items?: MockSettingDefinition[];
}

export class PluginSettingTab {
  app: unknown;
  plugin: { settings?: Record<string, unknown>; saveSettings?: () => Promise<void> };
  containerEl: unknown;
  settingItems: MockSettingDefinition[] = [];
  constructor(app: unknown, plugin: unknown) {
    this.app = app;
    this.plugin = plugin as PluginSettingTab["plugin"];
    this.containerEl = makeEl();
  }
  /** Overridden by plugins on 1.13+; the base returns nothing. */
  getSettingDefinitions(): MockSettingDefinition[] {
    return [];
  }
  /** Real Obsidian reads from `plugin.settings`; mirror that so unoverridden keys work. */
  getControlValue(key: string): unknown {
    return this.plugin.settings?.[key];
  }
  setControlValue(key: string, value: unknown): void | Promise<void> {
    if (this.plugin.settings) this.plugin.settings[key] = value;
  }
  update(): void {
    this.settingItems = this.getSettingDefinitions();
  }
  display() {}
  hide() {}
}

export class Plugin {
  app: unknown;
  manifest: unknown;
  _commands: { id: string }[] = [];
  _ribbons: unknown[] = [];
  _settingTabs: { display: () => void }[] = [];
  _views: { type: string; factory: unknown }[] = [];
  _events: unknown[] = [];
  _intervals: unknown[] = [];
  private _data: unknown = null;
  constructor(app: unknown, manifest: unknown) {
    this.app = app;
    this.manifest = manifest;
  }
  addRibbonIcon(_icon: string, _title: string, cb: unknown) { this._ribbons.push(cb); return makeEl(); }
  addCommand(cmd: { id: string }) { this._commands.push(cmd); return cmd; }
  addSettingTab(tab: { display: () => void }) { this._settingTabs.push(tab); }
  registerView(type: string, factory: unknown) { this._views.push({ type, factory }); }
  registerEvent(ref: unknown) { this._events.push(ref); }
  registerInterval(id: unknown) { this._intervals.push(id); return id; }
  async loadData() { return this._data; }
  async saveData(d: unknown) { this._data = d; }
  async onload() {}
  onunload() {}
}

/** サイドバーのビューが継承する土台。描画そのものはヘッドレスでは検証しない。 */
export class ItemView {
  containerEl = { children: [makeEl(), makeEl()] };
  constructor(public leaf: unknown) {}
  getViewType(): string { return ""; }
  getDisplayText(): string { return ""; }
  getIcon(): string { return ""; }
}

export class WorkspaceLeaf {}

export class ButtonComponent extends Component {
  constructor(_containerEl?: unknown) { super(); }
}

/** 取り消しの利かない操作の確認。開閉だけを再現する。 */
export class Modal {
  titleEl = makeEl();
  contentEl = makeEl();
  constructor(public app: unknown) {}
  open() { this.onOpen(); }
  close() { this.onClose(); }
  onOpen() {}
  onClose() {}
}

/**
 * Real classes, not interfaces: the store narrows with `instanceof TFile` /
 * `instanceof TFolder` (Obsidian's documented idiom), so the offline tests have
 * to construct genuine instances for that narrowing to behave as it does in the app.
 */
export class TAbstractFile {
  path = "";
}

export class TFile extends TAbstractFile {
  stat: { mtime: number; ctime: number; size: number } = { mtime: 0, ctime: 0, size: 0 };
  basename = "";
  extension = "";

  constructor(path?: string, mtime = 1) {
    super();
    if (path !== undefined) {
      this.path = path;
      const base = path.slice(path.lastIndexOf("/") + 1);
      const dot = base.lastIndexOf(".");
      this.basename = dot === -1 ? base : base.slice(0, dot);
      this.extension = dot === -1 ? "" : base.slice(dot + 1);
    }
    this.stat.mtime = mtime;
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];

  constructor(path?: string) {
    super();
    if (path !== undefined) this.path = path;
  }

  isRoot(): boolean {
    return this.path === "";
  }
}

/** Type-only aliases so the plugin's `import type` names resolve against the mock. */
export type SettingDefinitionItem = MockSettingDefinition;
export type SettingDefinitionRender = MockSettingDefinition;

/**
 * Obsidian's own language reader. The real one is
 * `localStorage.getItem("language") || <OS language>`; under Node there is
 * neither, and its documented default is "en" — so the mock returns that, and
 * the smoke test exercises the same "automatic ⇒ English" path the pilots see.
 */
export function getLanguage(): string {
  return "en";
}
