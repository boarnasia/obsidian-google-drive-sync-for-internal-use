# Obsidian CLI（公式 `obsidian` コマンド）

調査ノート。対象：**Obsidian 1.13.7 / installer 1.12.4（macOS）**、公式ヘルプ `Obsidian CLI.md`（obsidianmd/obsidian-help 最終更新 2026-09-08 `0c95e6c`）。
ソース変更なし、Vault を変更するコマンドは未実行（help / version / list / read 系のみ実行）。

**Bottom line:**
(1) Obsidian CLI は **起動中の Obsidian デスクトップアプリをソケット経由で操作するクライアント**。単体では動かず、アプリが落ちていれば最初のコマンドでアプリを起動する。
(2) 公式要件は **installer 1.12.7+** と **設定で「Command line interface」を ON**。この Mac は **installer 1.12.4 + 旧方式（`~/.zprofile` の PATH 追加で Electron 本体を叩く）** で動いてはいるが、公式推奨状態ではない（§1.3）。
(3) プラグイン開発に効くのは `plugin:reload` / `eval` / `dev:console` / `dev:errors` / `dev:screenshot` / `dev:dom` / `dev:css` / `dev:cdp`。
**落とし穴：エラーでも exit code 0・stdout に出る**（§3.5）、**`dev:screenshot path=` の相対パスは Vault 基準で書き込まれる**（§5.4）、**`dev:console` は `dev:debug on` 前は何も溜まらない**（§5.3）。

---

## 0. 根拠

| # | ソース | 実体 | 引用形式 |
| --- | --- | --- | --- |
| 1 | `https://obsidian.md/help/cli`（`help.obsidian.md/cli` から 301） | 公式ヘルプ。原稿は https://github.com/obsidianmd/obsidian-help `en/Extending Obsidian/Obsidian CLI.md` | URL |
| 2 | `https://obsidian.md/changelog/...` / `https://obsidian.md/changelog.xml` | 公式チェンジログ | URL |
| 3 | `obsidian` CLI の実行出力 | **実測** | コマンド + 出力 |
| 4 | `~/Library/Application Support/obsidian/obsidian-1.13.7.asar` | **出荷コード**（難読化 JS を grep） | 抜粋 |
| 5 | `node_modules/obsidian/obsidian.d.ts` ／ https://github.com/obsidianmd/obsidian-developer-docs | API 型定義・API リファレンス | path:line / URL |

以下、ヘルプ = 1、CL = 2、実測 = 3、asar = 4。**「未検証」と書いたもの以外はいずれかで裏付け済み。**

---

## 1. 何か・要件・導入

### 1.1 位置づけ

> "Obsidian CLI is a command line interface that lets you control Obsidian from your terminal for scripting, automation, and integration with external tools."
> "Obsidian CLI even includes developer commands to access developer tools, inspect elements, take screenshots, reload plugins, and more."
> — https://obsidian.md/help/cli

導入履歴（CL）：

| バージョン | 内容 | URL |
| --- | --- | --- |
| 1.12.0（Early access, 2026-02-10） | "Added a command line interface ..." | https://obsidian.md/changelog/2026-02-10-desktop-v1.12.0/ |
| 1.12.1（EA） | "If the vault parameter is included, it must be the first argument." | https://obsidian.md/changelog/2026-02-10-desktop-v1.12.1/ |
| 1.12.2（EA） | 既定でサイレント動作・アクティブファイル不要／**未知の `--` フラグを無視**／ワークスペース読込前にコマンドが走る不具合修正／指定 Vault が無いとき現 Vault を操作する不具合修正／macOS で CLI 実行中に Dock アイコンを出さない | https://obsidian.md/changelog/2026-02-18-desktop-v1.12.2/ |
| 1.12.4（**Public**, 2026-02-27） | "This release introduces the Obsidian CLI" | https://obsidian.md/changelog/2026-02-27-desktop-v1.12.4/ |
| 1.12.5（EA） | TUI で `id=` のコマンド ID 補完 | https://obsidian.md/changelog/2026-03-05-desktop-v1.12.5/ |
| 1.12.7（Public, 2026-03-23） | **installer に CLI 専用バイナリを同梱**（"replaces the old method of calling the Electron binary, resulting in significantly faster terminal interactions. Requires downloading the latest installer."）／ソケットを隠しファイル化 | https://obsidian.md/changelog/2026-03-23-desktop-v1.12.7/ |
| 1.13.0（EA）/ 1.13.4（Public） | "Fixed Obsidian CLI for flatpak installs." | https://obsidian.md/changelog/2026-07-30-desktop-v1.13.4/ |

プラグイン側 API `Plugin.registerCliHandler` は **@since 1.12.2**（`obsidian.d.ts:4994-5006`）。

### 1.2 要件

- **installer 1.12.7+**："Upgrade to the latest Obsidian installer version (1.12.7+)."（ヘルプ Install 節）。
  冒頭の警告枠は "Requires Obsidian 1.12 installer" で、同一ページ内で 1.12 と 1.12.7 が併記されている。専用バイナリが 1.12.7 からなので **実質 1.12.7+**。
- **アプリが起動している必要あり：**
  > "Obsidian CLI requires the Obsidian app to be running. If Obsidian is not running, the first command you run launches Obsidian."
  > "Obsidian must be running. The CLI connects to the running Obsidian instance."（Troubleshooting）
- **設定で有効化：** "Go to **Settings** → **General**. Enable **Command line interface**. Follow the prompt to register Obsidian CLI."（ヘルプ）
  無効時のメッセージは asar 上 `"Command line interface is not enabled. Please turn it on in Settings > General > Advanced."`。
  （姉妹ノート `obsidian-plugin-debugging.md` §9-3 は i18n キーから「設定 → About」と推定。1.13.7 の UI 上の正確な位置は **未検証**。）
- アプリ無しで Sync / Publish したいなら別製品 **Obsidian Headless**（`npm install -g obsidian-headless`、コマンドは `ob`、open beta、Node.js 22+）。
  > "Obsidian CLI controls the Obsidian desktop app from your terminal. Obsidian Headless is a standalone client that runs independently, no desktop app required."
  > — https://obsidian.md/help/headless（原稿 `en/Extending Obsidian/Obsidian Headless.md`）

### 1.3 PATH 登録（プラットフォーム別）

ヘルプ Troubleshooting 節：

| OS | 登録方式 | 確認 / 手動修復 |
| --- | --- | --- |
| **macOS** | `/usr/local/bin/obsidian` に symlink（管理者権限ダイアログ） | `ls -l /usr/local/bin/obsidian` ／ `sudo ln -sf /Applications/Obsidian.app/Contents/MacOS/obsidian-cli /usr/local/bin/obsidian` |
| **Windows** | ユーザー PATH に追加。1.12.7+ は `Obsidian.exe` と同じフォルダに端末リダイレクタ `Obsidian.com` | ターミナル再起動が必要 |
| **Linux** | `~/.local/bin/obsidian` に**コピー**（一時ディレクトリから動く配布形態があるため symlink しない） | `~/.local/bin` を PATH に。`cp /path/to/Obsidian/obsidian-cli ~/.local/bin/obsidian && chmod 755 ...` |

共通の対処："turn off the CLI setting and turn it back on again"、"Restart your terminal"。

macOS の旧方式について：
> "If you previously registered the CLI with an older version of Obsidian, you may have a leftover PATH entry in `~/.zprofile`. The new registration process removes this automatically, but if it remains, you can safely delete the lines starting with `# Added by Obsidian` from `~/.zprofile`."

**この Mac の実態（実測）：**

```
$ which obsidian
/Applications/Obsidian.app/Contents/MacOS/obsidian
$ grep -n -A1 "Added by Obsidian" ~/.zprofile
6:# Added by Obsidian
7:export PATH="$PATH:/Applications/Obsidian.app/Contents/MacOS"
$ ls /Applications/Obsidian.app/Contents/MacOS/
Obsidian                       # obsidian-cli は無い
$ ls /usr/local/bin/obsidian
No such file or directory
$ defaults read /Applications/Obsidian.app/Contents/Info.plist CFBundleShortVersionString
1.12.4
$ obsidian version
1.13.7 (installer 1.12.4)
```

→ **旧方式**。`obsidian` は大文字小文字を区別しない APFS 上で GUI 本体 `Obsidian`（Electron）に解決されていると推定（推定。ファイルシステムの大小区別設定は未確認）。
asar `main.js` は 2 つ目のインスタンスとして起動されると単一インスタンスロックに負け、ソケットに argv を投げて終了する実装で、これが旧方式の経路：

```js
if(!l.app.requestSingleInstanceLock()){ ...
  Tt(l.app.getVersion(),"1.11.7")&&console.log("Your Obsidian installer is out of date. ..."),
  W&&l.app.dock.hide(), ...
  let o=await new Promise(r=>{let u=(0,xe.createConnection)(x); ...});
  if(!o){console.error("Unable to connect to main process"),process.exit(1);return}
  o.write(JSON.stringify({argv:b,tty:w,cwd:process.cwd()})+"\n"), ...
```

**推奨：** installer を 1.12.7+ に更新し、CLI 設定を OFF→ON して再登録（ヘルプ記載手順）。更新は本調査では未実施。

### 1.4 通信の仕組み（asar）

```js
x = X ? `\\\\.\\pipe\\obsidian-cli-${de.userInfo().username}`
      : k.join(!W && process.env.XDG_RUNTIME_DIR || de.homedir(), ".obsidian-cli.sock");
```

- macOS：`~/.obsidian-cli.sock`、Linux：`$XDG_RUNTIME_DIR/.obsidian-cli.sock`（無ければ `~`）、Windows：名前付きパイプ `obsidian-cli-<user>`。
- クライアントは `{argv, tty, cwd}` を送る。**stdin/stdout が TTY かつ引数ゼロなら TUI**、それ以外は単発実行。
- 最後の引数が `obsidian://` URI なら URI として処理（CLI 無効でも通る。CL 1.12.2 "Fixed obsidian:// URIs not working if the CLI was not enabled"）。
- レンダラ側の `window.handleCli` はワークスペース準備完了まで `window.cliQueue` に積む（CL 1.12.2 の修正に対応）。

---

## 2. 起動形態

### 2.1 単発コマンド

```shell
obsidian help
obsidian help plugin:reload     # 特定コマンドのヘルプ
obsidian --help                 # asar: 第1引数が空 or "--help" なら help 扱い（実測で同じ出力）
```

### 2.2 TUI

> "Use the TUI by entering `obsidian`. Subsequent commands can be entered without `obsidian`."
> "The TUI supports autocomplete, command history, and reverse search. Use `Ctrl+R` to search your command history."
> — https://obsidian.md/help/cli

- TUI 専用コマンド：`vault:open <name|id>`（Vault 切替）、`exit` / `quit`（asar）。
- TUI 内で `obsidian ...` と打つと `You are already in the Obsidian TUI. Commands can be typed directly` と警告（asar）。
- キー操作（ヘルプ Keyboard shortcuts 節の要約）：
  `Tab` 補完に入る/確定、`Shift+Tab` 補完を抜ける、`→` 行末で候補確定、`↑`/`Ctrl+P`・`↓`/`Ctrl+N` 履歴、`Ctrl+R` 逆方向検索、
  `Ctrl+A`/`Ctrl+E` 行頭/行末、`Alt+B`/`Alt+F` 単語移動、`Ctrl+U`/`Ctrl+K` 行頭/行末まで削除、`Ctrl+W` 単語削除、
  `Escape` 補完取消/入力クリア、`Ctrl+L` 画面クリア、`Ctrl+C`/`Ctrl+D` 終了。
- TUI は本調査で**起動していない**（非 TTY 環境のため）。挙動はヘルプと asar のみに依拠。

---

## 3. 構文

### 3.1 parameter と flag

> "A **parameter** takes a value, written as `parameter=value`. If the value has spaces, wrap it in quotes"
> "A **flag** is a boolean switch with no value. Include it to turn it on"
> "For multiline content use `\n` for newline. Use `\t` for tab."
> — https://obsidian.md/help/cli

asar の解析：`=` を含む引数は `key=value`、含まないものは `key="true"`。**`=` の最初の位置で分割**するので値に `=` を含んでもよい。
`help` の出力で `(required)` 付きが必須。欠けると：

```
$ obsidian plugin
Error: Missing required parameter: id=<plugin-id>
Usage: plugin id=<plugin-id>
```

特殊文字はシェルでクォートする（ヘルプ例：`tasks 'status=?'`）。

### 3.2 Vault の選択

> "If your terminal's current working directory is a vault folder, that vault is used by default. Otherwise, the currently active vault is used."
> "Use `vault=<name>` or `vault=<id>` to target a specific vault. This must be the first parameter before your command"
> — https://obsidian.md/help/cli

```shell
obsidian vault=Notes daily
obsidian vault="My Vault" search query="test"
```

asar：`vault=` 指定 → 名前/ID 解決、無ければ CWD から解決、無ければアクティブ Vault。`vault=` が先頭以外なら**ただのパラメータ扱い**。
CWD が Vault の**サブディレクトリ**でも解決されるかは **未検証**。

実測（この Mac、`/tmp` から）：

```
$ obsidian vaults verbose
Vault01           /Users/.../GoogleDrive-.../マイドライブ/Obsidian/Vault01
gd-plugin-test    /Users/masatouehara/Documents/GVault/gd-plugin-test
trial-workos-nextjs-nestjs  /Users/masatouehara/dev/github.com/boarnasia/trial-workos-nextjs-nestjs
$ obsidian vault info=name
gd-plugin-test
```

### 3.3 ファイルの指定

> "`file=<name>` resolves the file using the same link resolution as wikilinks, matching by file name without requiring the full path or extension."
> "`path=<path>` requires the exact path from the vault root, e.g. `folder/note.md`."
> "If neither is provided, the command defaults to the active file."
> — https://obsidian.md/help/cli

注意：`bookmark` の `file=` と `tab:open` の `file=` は `<path>`（help 表記）。

### 3.4 出力形式

- コマンドごとに `format=` を持つものがある（既定値はコマンド別、§4 表参照）：
  `json|tsv|csv`（backlinks / bookmarks / hotkeys / plugins / tags / unresolved / tasks）、`json|csv|tsv|md|paths`（base:query）、
  `tree|md|json`（outline）、`yaml|json|tsv`（properties）、`text|json`（search / search:context）。
- **`--json` などの短縮形（公式ヘルプには無い）**：asar は `format` を持つコマンドで、許可値名と同じフラグ（`json` または `--json`）を `format=` に読み替える。
  クライアント側は `--copy --help --json --md --tsv --csv` 以外の `--` 引数を捨てる。実測：`obsidian plugins filter=community versions --json` → JSON 配列。
  **未文書の挙動なので、スクリプトでは `format=json` を使う。**
- **`--copy`**："Add `--copy` to any command to copy the output to the clipboard"（ヘルプ）。asar では `navigator.clipboard.writeText` で実装。
- `total` フラグ：件数だけ返す（多くの一覧系）。

### 3.5 エラーと終了コード — スクリプトで要注意

実測：

```
$ obsidian nosuchcmd; echo $?
Error: Command "nosuchcmd" not found. It may require a plugin to be enabled.
0
$ obsidian nosuchcmd 2>/dev/null     # → メッセージは表示される＝stdout
$ obsidian plugin; echo $?
Error: Missing required parameter: id=<plugin-id>
Usage: plugin id=<plugin-id>
0
```

**エラーでも exit 0、メッセージは stdout。** 成否判定は出力の `Error:` 接頭辞で行うしかない。
（`Unable to connect to main process` だけは asar 上 `process.exit(1)`。）

### 3.6 コマンド一覧はプラグイン状態で変わる

コア/コミュニティプラグインは `registerCliHandler` でコマンドを足すため、**プラグインが無効だとコマンド自体が存在しない。**
asar 例：`t.registerCliHandler("publish:site", ...)`（Publish）、`registerCliHandler("unique", ...)`（Unique note creator）、
`registerCliHandler("web", ...)`（Web viewer）、`registerCliHandler("workspaces", ...)`（Workspaces、`onEnable` 内）。

実測（`publish` / `webviewer` / `workspaces` / `zk-prefixer` が `false` の Vault）：

```
$ obsidian help publish:site
No commands matching "publish:site".
$ obsidian help workspaces
No commands matching "workspaces". Did you mean: workspace?
```

ローカル `obsidian help` は 476 行で、公式ヘルプにある `publish:*` / `unique` / `web` / `workspaces` / `workspace:save|load|delete` が無い。**ヘルプとローカル出力の差は、この仕組みで説明がつく。**
`vault:open` は TUI 専用で単発の `help` には出ない。

---

## 4. コマンド一覧（カテゴリ別）

出典：https://obsidian.md/help/cli ＋ 実測 `obsidian help`（1.13.7）。**★ = このローカル環境の `help` に無い（プラグイン無効 or TUI 専用）**。
「書込」列は Vault/アプリ状態を変更するもの（本調査では未実行）。

### 4.1 一般

| コマンド | 説明 | 主なオプション | 書込 |
| --- | --- | --- | --- |
| `help` | コマンド一覧 / `help <command>` | | |
| `version` | バージョン | | |
| `reload` | アプリウィンドウをリロード（asar: `window.location.reload()`） | | ✔ |
| `restart` | アプリ再起動（asar: `app.relaunch()`） | | ✔ |

### 4.2 ファイル・フォルダ

| コマンド | 説明 | 主なオプション | 書込 |
| --- | --- | --- | --- |
| `file` | ファイル情報（path/name/extension/size/created/modified） | `file=` `path=` | |
| `files` | ファイル一覧 | `folder=` `ext=` `total` | |
| `folder` | フォルダ情報 | `path=`(必須) `info=files\|folders\|size` | |
| `folders` | フォルダ一覧 | `folder=` `total` | |
| `read` | 内容を読む | `file=` `path=` | |
| `open` | 開く | `file=` `path=` `newtab` | |
| `create` | 作成/上書き | `name=` `path=` `content=` `template=` `overwrite` `open` `newtab` | ✔ |
| `append` / `prepend` | 末尾/先頭（frontmatter の後）に追記 | `content=`(必須) `inline` | ✔ |
| `move` | 移動/リネーム（設定次第で内部リンク更新） | `to=`(必須) | ✔ |
| `rename` | リネーム（拡張子は自動保持） | `name=`(必須) | ✔ |
| `delete` | 削除（既定はゴミ箱） | `permanent` | ✔ |
| `wordcount` | 語数・文字数 | `words` `characters` | |
| `random` / `random:read` | ランダムノートを開く/読む | `folder=` `newtab` | |
| `recents` | 最近開いたファイル | `total` | |

### 4.3 デイリーノート

| コマンド | 説明 | 主なオプション | 書込 |
| --- | --- | --- | --- |
| `daily` | 今日のノートを開く | `paneType=tab\|split\|window` | （作成されうる） |
| `daily:path` | パス（未作成でも期待パス） | | |
| `daily:read` | 読む | | |
| `daily:append` / `daily:prepend` | 追記 | `content=`(必須) `inline` `open` `paneType=` | ✔ |

### 4.4 検索

| コマンド | 説明 | 主なオプション |
| --- | --- | --- |
| `search` | 一致ファイルのパス | `query=`(必須) `path=` `limit=` `total` `case` `format=text\|json` |
| `search:context` | grep 風 `path:line: text` | 同上（`total` 無し） |
| `search:open` | 検索ビューを開く | `query=` |

### 4.5 タグ・プロパティ・エイリアス

| コマンド | 説明 | 主なオプション | 書込 |
| --- | --- | --- | --- |
| `tags` | タグ一覧 | `file=` `path=` `active` `counts` `sort=count` `total` `format=json\|tsv\|csv` | |
| `tag` | タグ情報 | `name=`(必須) `total` `verbose` | |
| `properties` | プロパティ一覧 | `file=` `path=` `active` `name=` `counts` `sort=count` `total` `format=yaml\|json\|tsv` | |
| `property:read` | 値を読む | `name=`(必須) | |
| `property:set` | 値を設定 | `name=` `value=`(必須) `type=text\|list\|number\|checkbox\|date\|datetime` | ✔ |
| `property:remove` | 削除 | `name=`(必須) | ✔ |
| `aliases` | エイリアス一覧 | `file=` `path=` `active` `total` `verbose` | |

### 4.6 タスク

| コマンド | 説明 | 主なオプション | 書込 |
| --- | --- | --- | --- |
| `tasks` | タスク一覧 | `file=` `path=` `active` `daily` `done` `todo` `status="<char>"` `verbose` `total` `format=json\|tsv\|csv`（既定 text） | |
| `task` | 表示/更新 | `ref=<path:line>` or `file=`+`line=` / `daily` ／ `toggle` `done` `todo` `status=` | 更新系フラグ付きで ✔ |

### 4.7 リンク・アウトライン

| コマンド | 説明 | 主なオプション |
| --- | --- | --- |
| `backlinks` | 被リンク | `file=` `path=` `counts` `total` `format=json\|tsv\|csv` |
| `links` | 発リンク | `file=` `path=` `total` |
| `unresolved` | 未解決リンク | `counts` `verbose` `total` `format=` |
| `orphans` | 被リンク無し | `total` （ローカル help には `all` も） |
| `deadends` | 発リンク無し | `total` （ローカル help には `all` も） |
| `outline` | 見出し | `format=tree\|md\|json` `total` |

### 4.8 ブックマーク・テンプレート・ユニークノート

| コマンド | 説明 | 主なオプション | 書込 |
| --- | --- | --- | --- |
| `bookmarks` | 一覧 | `total` `verbose` `format=` | |
| `bookmark` | 追加 | `file=` `subpath=` `folder=` `search=` `url=` `title=` | ✔ |
| `templates` | テンプレ一覧 | `total` | |
| `template:read` | 内容 | `name=`(必須) `resolve` `title=` | |
| `template:insert` | アクティブファイルに挿入 | `name=`(必須) | ✔ |
| ★`unique` | ユニークノート作成（Unique note creator 有効時） | `name=` `content=` `paneType=` `open` | ✔ |

`template:read resolve` は `{{date}}` `{{time}}` `{{title}}` を展開（ヘルプ）。

### 4.9 Bases

| コマンド | 説明 | 主なオプション | 書込 |
| --- | --- | --- | --- |
| `bases` | `.base` 一覧 | | |
| `base:views` | ビュー一覧 | | |
| `base:query` | クエリ結果 | `file=` `path=` `view=` `format=json\|csv\|tsv\|md\|paths` | |
| `base:create` | アイテム作成 | `view=` `name=` `content=` `open` `newtab` | ✔ |

### 4.10 コマンドパレット・ホットキー

| コマンド | 説明 | 主なオプション | 書込 |
| --- | --- | --- | --- |
| `commands` | コマンド ID 一覧（プラグイン登録分含む） | `filter=<prefix>` | |
| `command` | コマンド実行 | `id=`(必須) | 内容次第 |
| `hotkeys` | ホットキー一覧 | `total` `verbose` `all` `format=` | |
| `hotkey` | 1 コマンドのホットキー | `id=`(必須) `verbose` | |

### 4.11 プラグイン・テーマ・スニペット

| コマンド | 説明 | 主なオプション | 書込 |
| --- | --- | --- | --- |
| `plugins` / `plugins:enabled` | 一覧 | `filter=core\|community` `versions` `format=` | |
| `plugin` | 情報（type/name/version/author/enabled） | `id=`(必須) | |
| `plugin:enable` / `plugin:disable` | 有効/無効 | `id=`(必須) `filter=` | ✔ |
| `plugin:install` / `plugin:uninstall` | コミュニティプラグイン導入/削除 | `id=`(必須) `enable` | ✔ |
| `plugin:reload` | 開発用リロード（§5.1） | `id=`(必須) | ✔ |
| `plugins:restrict` | 制限モード確認/切替 | `on` `off` | ✔（on/off 時） |
| `themes` / `theme` | 一覧 / アクティブ or 詳細 | `versions` / `name=` | |
| `theme:set` / `theme:install` / `theme:uninstall` | | `name=`(必須) `enable` | ✔ |
| `snippets` / `snippets:enabled` | CSS スニペット一覧 | | |
| `snippet:enable` / `snippet:disable` | | `name=`(必須) | ✔ |

### 4.12 ファイル履歴・Sync・Publish

| コマンド | 説明 | 主なオプション | 書込 |
| --- | --- | --- | --- |
| `diff` | File recovery / Sync の版の一覧・比較（新しい順に番号） | `from=` `to=` `filter=local\|sync` | |
| `history` / `history:list` / `history:read` | ローカル履歴 | `version=` | |
| `history:restore` / `history:open` | 復元 / 画面を開く | `version=`(必須) | ✔ |
| `sync` | 一時停止/再開 | `on` `off` | ✔ |
| `sync:status` | 状態と使用量 | | |
| `sync:history` / `sync:read` / `sync:deleted` | 版一覧 / 読む / 削除済み | `version=` `total` | |
| `sync:restore` / `sync:open` | 復元 / 画面 | `version=`(必須) | ✔ |
| ★`publish:site` | サイト情報（slug, URL） | | |
| ★`publish:list` / `publish:status` | 公開済み / 変更一覧 | `total` `new` `changed` `deleted` | |
| ★`publish:add` / `publish:remove` | 公開 / 非公開 | `changed` | ✔ |
| ★`publish:open` | 公開サイトで開く | | |

`sync*` は **Obsidian Sync（公式有料サービス）** 用で、本プラグイン（Google Drive 同期）とは無関係。
> "These commands control Sync within the running Obsidian app. To sync vaults from the command line without the desktop app, see Headless Sync."（ヘルプ）

### 4.13 ワークスペース・タブ・Vault・Web viewer

| コマンド | 説明 | 主なオプション | 書込 |
| --- | --- | --- | --- |
| `workspace` | ワークスペースツリー | `ids` | |
| ★`workspaces` / `workspace:save` / `workspace:load` / `workspace:delete` | 保存済みレイアウト（Workspaces 有効時） | `name=` `total` | ✔（save/load/delete） |
| `tabs` | 開いているタブ | `ids` | |
| `tab:open` | 新規タブ | `group=` `file=` `view=` | |
| `vault` | Vault 情報 | `info=name\|path\|files\|folders\|size` | |
| `vaults` | 既知の Vault | `total` `verbose` | |
| ★`vault:open` | Vault 切替（**TUI 専用**） | `name=` | |
| ★`web` | Web viewer で URL を開く（有効時） | `url=`(必須) `newtab` | |

### 4.14 開発者コマンド

| コマンド | 説明 | 主なオプション |
| --- | --- | --- |
| `devtools` | Electron DevTools を開閉 | |
| `dev:debug` | CDP デバッガを attach/detach（引数無しで状態表示） | `on` `off` |
| `dev:cdp` | CDP コマンド実行（JSON で返る） | `method=`(必須) `params=<json>` |
| `dev:console` | 捕捉したコンソール出力 | `limit=`(既定 50) `level=log\|warn\|error\|info\|debug` `clear` |
| `dev:errors` | 捕捉した JS エラー | `clear` |
| `dev:screenshot` | スクリーンショット | `path=` |
| `dev:dom` | DOM クエリ | `selector=`(必須) `total` `text` `inner` `all` `attr=` `css=` |
| `dev:css` | マッチした CSS ルールとソース位置 | `selector=`(必須) `prop=` |
| `dev:mobile` | モバイルエミュレーション（リロードを伴う） | `on` `off` |
| `eval` | JS を実行し結果を返す | `code=`(必須) |

---

## 5. プラグイン開発向けの詳細（asar と実測）

### 5.1 `plugin:reload`

asar の実装：コアプラグインなら `disable → enable`。コミュニティプラグインなら
**`disablePlugin(id)` → `loadManifests()` → `enablePlugin(id)`**。`manifest.json` も読み直す。
失敗メッセージ：`Plugin "<id>" is not enabled.`（**無効のプラグインは reload できない**）、`Plugin "<id>" not found. Use "plugins" to list available plugins.`

実測（姉妹ノート §3.4）：`obsidian plugin:reload id=google-drive-sync-for-internal-use` → `Reloaded: google-drive-sync-for-internal-use`。

`onunload()` → `onload()` が走るのでインメモリ状態は消える（姉妹ノート §8.3 の `selfWritten` 等）。

### 5.2 `eval`

asar：`window.eval(code)` を await。実行中は `console.log/warn/error` を横取りして出力に含め（`[warn]` `[error]` 接頭辞）、戻り値は `=> <JSON>` で表示。

```
$ obsidian eval 'code=localStorage.getItem(app.appId+"-DebugMode")'
=> "\"1\""                                   # 姉妹ノート §2.3 の実測
```

- レンダラのメインワールドで動くのでグローバル `app` が使える。`app.plugins.plugins["<id>"]` で自プラグインのインスタンスに届く（未文書 API、姉妹ノート §4.3）。
- `require("obsidian")` は解決できない（姉妹ノート §1.3 実測）。
- Promise を返せば await される（asar の `[4, window.eval(e)]`）。
- 副作用のある JS も実行できる。**Vault を壊すコードを流さないこと。**

### 5.3 `dev:debug` / `dev:console` / `dev:errors` / `dev:cdp` / `dev:css`

asar：

- **`dev:console`** は CDP `Runtime.consoleAPICalled` を拾うバッファ（最大 200 件）。**デバッガ未接続だと
  `Debugger not attached. Use "dev:debug on" to start capturing console messages.` を投げる。** `dev:debug on` 以前のログは取れない。
- **`dev:errors`** は CDP と独立したバッファ（最大 50 件、`error` / `unhandledrejection` 由来と推定される `e.reason.stack` 処理あり）。
  実測：`obsidian dev:errors` → `No errors captured.`
- **`dev:cdp` と `dev:css` は内部で自動 attach**（`p.isAttached()||p.attach("1.3")` → `Runtime.enable` / `DOM.enable` / `CSS.enable`）。以後コンソール捕捉も始まる。
- `dev:debug off` でバッファも消える。
- DevTools を開くと CDP デバッガは外れる（Electron 仕様。姉妹ノート §1.4、https://www.electronjs.org/docs/latest/api/debugger）。

### 5.4 `dev:screenshot` — 保存先に注意

公式ヘルプは "Take a screenshot (returns base64 PNG)" と書くが、**1.13.7 の asar はファイルに書いてパスを返す**：

```js
l = s && e instanceof Ql            // Ql = デスクトップの FileSystemAdapter と推定
      ? (a.isAbsolute(s) ? s : a.join(e.getBasePath(), s))
      : a.join(sf("os").tmpdir(), "obsidian-screenshot-" + Date.now().toLocaleString("sv") + ".png");
o.writeFileSync(l, i); return l;
```

- `path=` 省略 → OS の一時ディレクトリに保存。
- **相対 `path=` は Vault ルート基準**＝Vault 内に PNG が増える（同期対象になりうる）。**絶対パスを渡す。**
- 「base64 を返す」はこのバージョンでは不一致（ヘルプの記述が古い、または別経路。**実行は未検証**）。

### 5.5 `dev:dom`

asar：`document.querySelectorAll(selector)`。既定は最初の要素の outerHTML、`all` で全件、`text` / `inner` / `attr=` / `total`。
`css=<prop>` は `getComputedStyle` の値。一致無しは `No elements found.`。設定タブの描画確認に使える（例は cheat sheet）。

### 5.6 `devtools` / `dev:mobile`

- `devtools`：`toggleDevTools()` → `Toggled dev tools.`（姉妹ノート §1.1 実測）
- `dev:mobile on|off`：`app.emulateMobile()` を呼びリロード。本プラグインは `isDesktopOnly: true` なので「モバイルで弾かれるか」の確認用（姉妹ノート §7）。

### 5.7 自作プラグインに CLI コマンドを生やす：`registerCliHandler`

`node_modules/obsidian/obsidian.d.ts:4994-5006`、https://docs.obsidian.md/Reference/TypeScript+API/Plugin/registerCliHandler

```ts
registerCliHandler(command: string, description: string, flags: CliFlags | null, handler: CliHandler): void;
// CliFlags = Record<string, CliFlag>;  CliFlag = { value?: string; description: string; required?: boolean }   // :1609-1634
// CliData  = { [key: string]: string | 'true' }                                                                   // :1597-1603
// CliHandler = (params: CliData) => string | Promise<string>                                                      // :1640
```

- "Command IDs must be globally unique. Attempting to register a command that is already registered will throw an Error."
- "Use the format `<plugin-id>` for your default command, and `<plugin-id>:<action>` for sub-commands and actions."
- flag 値は文字列、値無しフラグは `'true'`（型定義と asar のパーサが一致）。
- `required: true` の欠落は CLI 側でチェックされ `Missing required parameter` になる（asar）。
- 登録/解除のライフサイクル（プラグイン unload 時に自動解除されるか）は asar に `unregisterHandler` があるが、**Plugin 経由の自動解除は未検証**。

---

## 6. 制限・プラットフォーム差

- **デスクトップ専用。** アプリ起動が前提（§1.2）。モバイル版 CLI の記述はヘルプに無い。
- **Windows** は GUI アプリが stdout に出せないため `Obsidian.com` リダイレクタ経由（ヘルプ）。旧来は `session=` 付き 2 つ目のインスタンスと名前付きパイプで中継（asar）。
- **Linux** はバイナリを `~/.local/bin` にコピー。Flatpak は 1.13.0 で修正（CL）。ソケットは `$XDG_RUNTIME_DIR` 優先（asar）。
- **macOS** は `/usr/local/bin` symlink 作成に管理者権限。旧方式（Electron 本体呼び出し）は遅い（CL 1.12.7）。
- **終了コードが成否を表さない**（§3.5）。
- **コマンドの有無は Vault のプラグイン設定に依存**（§3.6）。スクリプトは対象 Vault を `vault=` で固定する。
- **制限モード / 管理ポリシー**：`plugin` 系は `Restricted: plugins are disabled.` を投げうる（asar `Ab.plugins===false` 分岐）。
- **サンドボックス環境（Claude Code の Bash サンドボックス）では、CWD が `~/Documents` 配下の Vault のとき出力が空・exit 0 になった**（実測。サンドボックス解除で正常、476 行）。
  CLI 自体の制約ではない。エージェントから使うときは `vault=` 指定で CWD 依存を避けるのが無難。
- 公式ヘルプの Windows/Linux の手順は**この Mac では未検証**。

### 6.1 同名のサードパーティツール

コミュニティ製 "Obsidian CLI (Community)" が存在する（https://github.com/Yakitrak/notesmd-cli 、旧名 `obsidian-cli`）。
公式とは別物で本ノートの対象外。内容は未調査。

---

## 7. このプロジェクトでの使いどころ

1. **開発ループ：** `npm run dev` ＋ `obsidian vault=gd-plugin-test plugin:reload id=google-drive-sync-for-internal-use`（姉妹ノート §9-3）。
2. **ログ：** 作業開始時に `dev:debug on`、以後 `dev:console level=error` / `dev:errors`。ただし `quiet` 経路の失敗は現状 `console.*` に出ない（姉妹ノート §8.3・§9-4）。
3. **設定 UI の目視代替：** `dev:dom selector=".vertical-tab-content" text` や `dev:screenshot path=/tmp/x.png`（**絶対パス**）。
4. **内部状態：** `eval 'code=...app.plugins.plugins["google-drive-sync-for-internal-use"]...'`、恒常的には `registerCliHandler` で `google-drive-sync-for-internal-use:state` 等を生やす（§5.7。ID は `<plugin-id>:<action>` 形式が推奨）。
5. **環境整備（未実施）：** installer を 1.12.7+ に更新し、CLI 設定を OFF→ON で再登録、`~/.zprofile` の `# Added by Obsidian` 行を確認（§1.3）。

---

## 付録：未検証・未解決

| 項目 | 状態 |
| --- | --- |
| 1.13.7 で CLI トグルが「General」直下か「General > Advanced」か「About」か | ヘルプ=General、asar メッセージ=General > Advanced、i18n キー=about。**UI 未確認** |
| `dev:screenshot` が base64 を返すケース | ヘルプ記載のみ。asar はファイル保存。**未実行** |
| TUI の実挙動 | ヘルプ + asar のみ。**未起動** |
| CWD が Vault のサブディレクトリの場合の Vault 解決 | **未検証** |
| `registerCliHandler` の unload 時の自動解除 | **未検証** |
| installer 1.12.7+ の `obsidian-cli` バイナリの挙動差 | 本機は 1.12.4。**未検証** |
| `--json` 等の短縮フラグ | asar と実測で動作確認済みだが**公式未文書** |

## 付録：根拠の索引

| 主張 | ソース |
| --- | --- |
| CLI の定義、要件（1.12.7+ / アプリ起動 / 設定）、構文、全コマンド、TUI キー、トラブルシュート | https://obsidian.md/help/cli ／ https://github.com/obsidianmd/obsidian-help `en/Extending Obsidian/Obsidian CLI.md` |
| Headless との違い | https://obsidian.md/help/headless ／ 同 repo `en/Extending Obsidian/Obsidian Headless.md` |
| 導入経緯・各修正 | https://obsidian.md/changelog/2026-02-10-desktop-v1.12.0/ ほか §1.1 表 ／ https://obsidian.md/changelog.xml |
| 専用バイナリ（1.12.7）・隠しソケット | https://obsidian.md/changelog/2026-03-23-desktop-v1.12.7/ |
| ソケットパス、単一インスタンス経由の旧方式、TTY で TUI、`obsidian://` 処理、CLI 無効メッセージ | asar `main.js` |
| 引数解析、`--help`→help、`--json` 読替、`--copy`、未知コマンドのエラー文 | asar `app.js` `window.handleCli` ／ 実測 |
| エラーで exit 0・stdout | 実測 |
| プラグイン依存コマンド（publish / unique / web / workspaces） | asar `registerCliHandler(...)` ／ 実測 `help publish:site` |
| `plugin:reload` / `eval` / `dev:*` の実装 | asar `registerHandler(...)` |
| ローカル環境（旧 PATH 登録、installer 1.12.4、Vault 一覧） | 実測 `which` / `~/.zprofile` / `Info.plist` / `obsidian version` / `obsidian vaults verbose` |
| `registerCliHandler` と型 | `node_modules/obsidian/obsidian.d.ts:1597-1640`, `:4994-5006` ／ https://docs.obsidian.md/Reference/TypeScript+API/Plugin/registerCliHandler |
| サードパーティ CLI | https://github.com/Yakitrak/notesmd-cli |
