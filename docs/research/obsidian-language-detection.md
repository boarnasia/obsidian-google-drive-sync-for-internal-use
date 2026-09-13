# Reading Obsidian's UI display language from a plugin

Research notes. Written against **Obsidian 1.13.7 (macOS)** and **obsidian API 1.13.0**.
No source file was modified; this is analysis only.

**Bottom line:** `localStorage.getItem("language")` is not a bug in our *key name* — it is the
right key. It is a bug in our *assumption*. Obsidian only writes that key when the user
**explicitly picks** a language. When Obsidian infers the language from the OS (which is what
happened on this machine), the key is **never written**, and `getItem` correctly returns `null`.
The supported API — `getLanguage()` from the `obsidian` module — encapsulates exactly that
missing fallback. Use it.

---

## 0. Evidence base

Three classes of primary source were used. The strongest is the third.

| Source | What it is | How cited below |
| --- | --- | --- |
| `docs.obsidian.md` / `obsidianmd/obsidian-api` | Official API docs + published typings | URL |
| `node_modules/obsidian/obsidian.d.ts` | Obsidian API 1.13.0 typings, local | path + line |
| `obsidian-1.13.7.asar` → `app.js` | **Obsidian's own shipped implementation**, on this machine | quoted, deobfuscated |
| `~/Library/Application Support/obsidian/Local Storage/leveldb` | The live localStorage backing store | key dump |

The asar is the authority: it is not documentation about the behaviour, it *is* the behaviour.

Extraction used for reproducibility:

```
# app.js lives at offset 637090, length 3876459 inside the asar's data section
python3 -c "..." # parse asar header, slice app.js out
grep -o -aE '.{180}"language".{220}' app.js
```

---

## 1. Is `localStorage.getItem("language")` still correct in 1.13.x?

**The key name is exactly `"language"`, it is global (NOT vault-namespaced), and it is still
used in 1.13.7 — but reading it directly is wrong because it is frequently absent.**

### 1.1 The key name and the default, from Obsidian's own source

`obsidian-1.13.7.asar` → `app.js`:

```js
var od = "language",
    ad = "en",
    sd = { zh: "zh-cn", cz: "cs", no: "nb" },       // Obsidian-lang -> moment-locale fixups
    ld = ["ar","dv","fa","ff","he","ks","ku","ur","wo","yi"];  // RTL languages
```

`od` is the localStorage key. It is the bare string `"language"`. No prefix, no vault id.

### 1.2 The read path — this is what `getLanguage()` actually is

```js
function pd() {
  return localStorage.getItem(od) || fd();
}
```

and the exported API surface binds straight to it:

```js
getLanguage: () => pd,
```

So, definitively:

> **`getLanguage()` === `localStorage.getItem("language") || <system-language fallback>`**

Our code implements the left half of that `||` and drops the right half. That is the entire bug.

### 1.3 The fallback we are missing

```js
function fd() {
  var e = navigator.language;             // e.g. "ja-JP"
  if (Kp.contains(e)) return e;           // exact match against supported list
  var t = e.split("-")[0];                // "ja"
  if (Kp.contains(t)) return t;           // region-stripped match
  return ad;                              // "en"
}
```

where the supported list is derived from Obsidian's language display-name map:

```js
Kp = Object.keys(_p).sort();
```

### 1.4 The write path — why the key is usually missing

```js
function dd(e) {
  var t = (e === ad && fd() === ad);              // "chose English, and system is English too"
  t ? localStorage.removeItem(od)
    : localStorage.setItem(od, e);
  rd.isDesktopApp && electron.ipcRenderer.sendSync("set-language", t ? null : e);
}
```

`dd` is the **setter**, and it is only invoked by the Settings → About → Language dropdown.
Nothing writes the key at startup. Nothing writes it when the language is merely *inferred*.

**Therefore: `language` in localStorage is absent whenever the user has never touched the
dropdown** — including every user running Obsidian in their OS language by default.

### 1.5 Did this change across versions?

No breaking change to the key. What changed is that in **1.8.7** Obsidian made the correct
read path public as `getLanguage()`, so plugins no longer need to reimplement §1.3:

- `/Users/masatouehara/dev/github.com/sertacyildiz/obsidian-google-sync/node_modules/obsidian/obsidian.d.ts:3329-3334` carries `@since 1.8.7`
- https://docs.obsidian.md/Reference/TypeScript+API/getLanguage confirms "Since version: 1.8.7"

Before 1.8.7, `localStorage.getItem("language")` was the only option available to plugins, which
is why it is still all over the ecosystem (§3). It was *always* incomplete; 1.8.7 gave us the fix.

### 1.6 Vault namespacing — confirmed NOT applied to `language`

Obsidian *does* have a vault-namespaced localStorage helper, and `language` deliberately does not
use it. From `app.js`:

```js
e.prototype.loadLocalStorage = function (e) {
  try { var t = localStorage.getItem(this.appId + "-" + e); if (t) return JSON.parse(t); } catch (e) {}
  return null;
};
e.prototype.saveLocalStorage = function (e, t) {
  try { t ? localStorage.setItem(this.appId + "-" + e, JSON.stringify(t))
          : localStorage.removeItem(this.appId + "-" + e); } catch (e) {}
};
```

Typed at `obsidian.d.ts:467-480` (`App.loadLocalStorage` / `App.saveLocalStorage`, both `@since 1.8.7`).

Note the asymmetry, which matters:

- `app.loadLocalStorage(k)` reads `"<vaultId>-<k>"` and **`JSON.parse`s** it.
- `language` is written with a raw `localStorage.setItem(od, e)` — **global, unprefixed, unquoted plain string**.

So `app.loadLocalStorage("language")` is **wrong twice**: wrong key, and it would try to
`JSON.parse("ja")` and throw (caught, returns `null`). Do not use it for this.

This is visible in the live store. Dumping every key from
`~/Library/Application Support/obsidian/Local Storage/leveldb` (origin `app://obsidian.md`):

```
'00d767bcc59e495f-plugin-automatically-check-for-updates'
'00d767bcc59e495f-recent-commands'
'1ebb801f0de653e7-file-explorer-unfold'
'89a2c9f120b93a09-file-explorer-unfold'
'89a2c9f120b93a09-last-plugin-update-check'
'e025c1532cc9e7d4-recent-searches'
'enable-plugin-00d767bcc59e495f'
'enable-plugin-1ebb801f0de653e7'
'test'
```

Vault-scoped keys carry the `<vaultId>-` prefix; `enable-plugin-*` and `test` are global.
**`language` is not present at all** — on a machine whose Obsidian UI is running in Japanese.

---

## 2. What the official API exposes

Exhaustive grep of the local typings for `language|locale|i18n|lang|moment|translat`:

```
$ grep -niE "language|locale|i18n|lang|moment|translat" node_modules/obsidian/obsidian.d.ts
```

Everything language-related that came back:

### 2.1 `getLanguage()` — the answer

`/Users/masatouehara/dev/github.com/sertacyildiz/obsidian-google-sync/node_modules/obsidian/obsidian.d.ts:3329-3334`:

```ts
/**
 * Get the ISO code for the currently configured app language. Defaults to 'en'.
 * See {@link https://github.com/obsidianmd/obsidian-translations?tab=readme-ov-file#existing-languages} for list of options.
 * @public
 * @since 1.8.7
 */
export function getLanguage(): string;
```

Official docs: https://docs.obsidian.md/Reference/TypeScript+API/getLanguage

**Availability check for us:** our `manifest.json` declares `"minAppVersion": "1.13.0"`, which is
comfortably above 1.8.7. `getLanguage` can be imported and called **unconditionally**, with no
feature detection. No guard needed.

### 2.2 `moment` — a bundled re-export, usable as a weak secondary signal

`obsidian.d.ts:8` and `obsidian.d.ts:4519`:

```ts
import * as Moment from 'moment';
...
/** @public */
export const moment: typeof Moment;
```

Obsidian keeps moment's global locale in sync with the app language (`app.js`):

```js
try {
  var gd = md.toLowerCase();
  sd.hasOwnProperty(gd) && (gd = sd[gd]);   // zh->zh-cn, cz->cs, no->nb
  window.moment.locale(gd);
} catch (wu) {}
```

where `md = pd()` — i.e. seeded from `getLanguage()`. So `moment.locale()` does track the UI
language, **but it is lossy and unreliable**:

- The `sd` map rewrites codes (`zh` → `zh-cn`, `no` → `nb`), so it is not the same namespace.
- The whole block is wrapped in `try {} catch {}` — a failure leaves moment on `"en"` silently.
- `moment.locale(x)` silently keeps the previous locale if the locale bundle for `x` is absent.
- Any plugin can call `moment.locale()` globally and clobber it. Periodic Notes does exactly this
  (`moment.updateLocale(...)`): https://github.com/liamcain/obsidian-periodic-notes/blob/main/src/settings/localization.ts

Fine as a last-ditch fallback. Never as the primary.

### 2.3 Everything else: negative results

Grepped for and **not found** as public API:

- **No** `App.language`, `App.locale`, `App.i18n` — the full `App` class (`obsidian.d.ts:406-480`)
  exposes only `keymap`, `scope`, `workspace`, `vault`, `metadataCache`, `fileManager`,
  `lastEvent`, `renderContext`, `secretStorage`, `isDarkMode()`, `loadLocalStorage()`,
  `saveLocalStorage()`.
- **No** `app.vault.config` / `Vault.getConfig()` in the typings. `getConfig` appears only inside
  two doc comments (`obsidian.d.ts:6507`, `:6520`) describing default behaviour — it is an
  undocumented internal, not API, and it does **not** hold the language (the language is global,
  not per-vault; see §1.6).
- **No** `i18next` export. Obsidian uses i18next internally (`i18next.init({...})` in `app.js`) but
  does not expose it. The `bd` translation proxy is internal.
- Remaining `language` hits are unrelated: `registerMarkdownCodeBlockProcessor(language, ...)`
  (`obsidian.d.ts:4959`) and friends refer to *code fence* languages.

---

## 3. What real community plugins do

Two distinct generations. The split is cleanly at API 1.8.7.

### 3.1 Modern — `getLanguage()` (correct)

**obsidian-tasks** — https://github.com/obsidian-tasks-group/obsidian-tasks/blob/main/src/i18n/i18n.ts

```ts
import i18next from 'i18next';
import { getLanguage } from 'obsidian';
...
// Get Obsidian language settings
const getObsidianLanguage = (): string => {
    const storedLanguage = getLanguage();
    return storedLanguage || 'en';
};

export const initializeI18n = async () => {
    if (!isInitialized) {
        await i18next.init({
            lng: getObsidianLanguage(),
            fallbackLng: 'en', // Fallback language if detection fails or translation is missing
```

Note the belt-and-braces `|| 'en'` even though `getLanguage()` already defaults to `'en'`, and the
separate i18next `fallbackLng`. Also note the comment on its resource keys:

```ts
// key: the Obsidian "Language code", defined in
//      https://github.com/obsidianmd/obsidian-translations?tab=readme-ov-file#existing-languages
```

**obsidian-excalidraw-plugin** — https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/src/constants/constants.ts

```ts
import { getLanguage } from "obsidian";
...
export const LOCALE = getLanguage().toLowerCase();
```

Normalises case at the boundary. (This means it matches on `pt-br`, not `pt-BR` — see §4.)

**obsidian-linter** — https://github.com/platers/obsidian-linter/blob/master/src/main.ts

```ts
import {App, Editor, ..., getLanguage} from 'obsidian';
import {moment} from 'obsidian';
import {getTextInLanguage, LanguageStringKey, setLanguage} from './lang/helpers';
...
    setLanguage(getLanguage());
...
    const obsidianLang: string = getLanguage() || 'en';
    let momentLocale = langToMomentLocale[obsidianLang as keyof typeof langToMomentLocale];
```

Linter is the most instructive: it uses `getLanguage()` for UI strings **and** maintains its own
`langToMomentLocale` map, i.e. it treats the Obsidian language code and the moment locale as two
different namespaces — matching Obsidian's own `sd` map (§2.2). Its helper guards explicitly:

```ts
export function setLanguage(newLang: string) {
  lang = newLang;
  locale = localeMap[lang];
  if (!locale) {
    logWarn(`locale not found for '${lang}'`);
    locale = localeMap[defaultLang];   // defaultLang = 'en'
  }
}
```

### 3.2 Legacy — raw localStorage (still widespread, still subtly broken)

**obsidian-kanban** — https://github.com/mgmeyers/obsidian-kanban/blob/main/src/lang/helpers.ts

```ts
const lang = window.localStorage.getItem('language');
const locale = localeMap[lang || 'en'];

export function t(str: keyof typeof en): string {
  if (!locale) {
    console.error('Error: kanban locale not found', lang);
  }
  return (locale && locale[str]) || en[str];
}
```

This is **character-for-character our bug**. A Japanese user who never touched the dropdown gets
`lang === null` → `localeMap['en']` → English UI inside a Japanese Obsidian. Kanban has a `ja`
locale file that such a user will never see.

**obsidian-periodic-notes** — https://github.com/liamcain/obsidian-periodic-notes/blob/main/src/settings/localization.ts
also predates `getLanguage()`.

How common is the legacy pattern? A GitHub code search for the literal
`localStorage.getItem("language")` returns **1,016 files**:

```
$ gh api -X GET search/code -f q='"localStorage.getItem(\"language\")" obsidian'
{"total_count":1016, ...}
```

**Conclusion on prevalence:** raw `localStorage` is the *more common* pattern purely because it is
older and gets copy-pasted between plugins. Every actively-maintained plugin checked has migrated
to `getLanguage()`. Popularity here is inertia, not endorsement. Every implementation reviewed —
both generations — falls back to `'en'` on a miss, and the well-maintained ones log or warn.

---

## 4. What is the actual stored value?

**A bare Obsidian language code, region suffix only when the code itself has one.** For Japanese
it is exactly `"ja"`. Never `"ja-JP"`, never `"jp"`.

Three independent confirmations:

1. **Translation filenames in the asar** are the codes verbatim:
   `/i18n/ja.txt`, `/i18n/en-GB.txt`, `/i18n/pt-BR.txt`, `/i18n/zh.txt`.
2. **Obsidian's language display map** (`app.js`), whose keys *are* the valid values —
   `Kp = Object.keys(_p).sort()`:

   ```js
   { am:"አማርኛ", ar:"اَلْعَرَبِيَّةُ", be:"беларуская мова", bn:"বাংলা", ca:"català", cs:"čeština",
     da:"Dansk", de:"Deutsch", en:"English", "en-GB":"English (GB)", es:"Español", fa:"فارسی",
     fi:"suomi", fr:"Français", ga:"Gaeilge", he:"עברית", hu:"Magyar", id:"Bahasa Indonesia",
     it:"Italiano", ja:"日本語", ka:"ქართული", kh:"ខ្មែរ", ko:"한국어", lv:"Latviešu",
     ms:"Bahasa Melayu", ne:"नेपाली", nl:"Nederlands", no:"Norsk", pl:"Polski", pt:"Português",
     "pt-BR":"Português do Brasil", ro:"Română", ru:"Pусский", sk:"Slovenčina", sq:"Shqip",
     sr:"српски језик", sv:"Svenska", th:"ไทย", tr:"Türkçe", uk:"Українська", uz:"oʻzbekcha",
     vi:"Tiếng Việt", zh:"简体中文", "zh-TW":"繁體中文" }
   ```

3. **The official translations repo** — https://github.com/obsidianmd/obsidian-translations
   — lists Japanese as `ja`, Chinese Simplified `zh`, Traditional `zh-TW`, Brazilian Portuguese
   `pt-BR`, British English `en-GB`.

**Sources do not disagree.** All three agree exactly.

Three consequences worth designing for:

- Only **four** codes carry a region: `en-GB`, `pt-BR`, `zh-TW` (and `zh` vs `zh-TW`). So
  `startsWith("ja")` works today, but prefix-matching in general must be done on the
  region-stripped code, not the raw string.
- `fd()` returns `navigator.language` **verbatim** when it is an exact list member. On a
  `en-GB` system, `getLanguage()` returns `"en-GB"`, not `"en"`. Anything doing `=== "en"` breaks.
- **Gotcha:** `getLanguage()` can return **a filesystem path**, not a language code. Obsidian
  supports loading a custom translation file (`app.js`):

  ```js
  window.selectLanguageFileLocation = function () {
    ... electron.remote.dialog.showOpenDialogSync({ title: "Pick location of translation file", ... })
    ... localStorage.setItem(od, t), location.reload();
  }
  ```

  and the read side branches on it: `md.contains("/") || md.contains("\\")`. Rare, but a
  `startsWith` check must not be fooled by e.g. `/Users/x/ja-custom.json`.

---

## 5. Electron / renderer specifics

**Origin.** Obsidian's renderer runs on the custom scheme origin **`app://obsidian.md`**. Confirmed
by dumping the leveldb key prefixes:

```
META:app://obsidian.md
_app://obsidian.md<NUL><SOH><key>
```

backed by `~/Library/Application Support/obsidian/Local Storage/leveldb/`.

**Readable from plugin code?** Yes, fully. A plugin is JS evaluated in that same renderer and
therefore the same origin — there is one shared `localStorage` for the whole app, not one per
plugin. Obsidian itself relies on this (`app.loadLocalStorage` is just a prefixing convention over
the same store, §1.6). Nothing sandboxes it away.

**Timing.** No timing issue, in either direction:

- `localStorage` is a **synchronous** API backed by an in-memory map that Chromium populates before
  any script runs. There is no "not loaded yet" window.
- `getLanguage()` is a pure synchronous function over that map plus `navigator.language` (§1.2).
- Obsidian resolves the language and calls `i18next.init` during app boot, long before plugins are
  loaded — `getLanguage()` is correct even at module-evaluation time, not just in `onload()`.

So our module-level `export const t: Strings = { ...dictFor("auto") }` is **safe as written**. It
was never a race. The value read was simply `null`.

**One real caveat, unrelated to timing:** `localStorage` access throws in some contexts, and
Obsidian's own code wraps every access in `try/catch` (§1.6). Our existing `try/catch` in
`detectLang()` is correct and should be kept. In Node (our test pilots) there is no `window` at
all, and `getLanguage` imported from `obsidian` will not resolve — the `typeof window === "undefined"`
guard must stay, and the `getLanguage` call must be inside the `try`.

---

## 6. Root cause on this machine — the chain, verified end to end

1. macOS is configured for Japanese:

   ```
   $ defaults read -g AppleLanguages
   ( "ja-JP", "en-JP", "zh-Hans-JP" )
   $ defaults read -g AppleLocale
   ja_JP
   ```

2. Electron therefore reports `navigator.language === "ja-JP"`.
3. `fd()` (§1.3): `"ja-JP"` is **not** in `Kp` (the list has `ja`, not `ja-JP`) → falls to
   `"ja-JP".split("-")[0]` → `"ja"` → **is** in `Kp` → returns `"ja"`.
4. Obsidian loads `/i18n/ja.txt` and renders its UI in Japanese. The Settings → About → Language
   dropdown displays 日本語 because its value is `pd()`, the *resolved* language — which is why the
   UI looks like an explicit setting when it is not.
5. **`dd()` (the setter) was never called**, so `localStorage` was never written.
6. Live confirmation: the key dump in §1.6 contains **no `language` key**.
7. Our `detectLang()` reads `null`, `?? ""`, `"".startsWith("ja")` is `false` → returns `"en"`.

Every step is verified against shipped code or live state. There is no remaining uncertainty.

Note also that the settings key is `setting.about.option-language` (from the asar's
`/i18n/mapping.txt`), i.e. the control lives under **Settings → About**, not Settings → General.
The `languageDesc` strings in `src/i18n.ts` currently say "Settings → General" / 「設定 → 一般」
in both `en` and `ja`. Minor, but wrong in 1.13.x, and worth fixing alongside.

---

## 7. RECOMMENDATION

Replace `detectLang()` in `src/i18n.ts` with the following. Nothing else in the file needs to
change — `dictFor`, `t` and `setLanguage` keep working as-is.

```ts
import { getLanguage } from "obsidian";

/**
 * Obsidian's own display language, as a language we have strings for.
 *
 * `getLanguage()` is the supported reading (API 1.8.7+; our minAppVersion is
 * 1.13.0, so it is always present). It is NOT the same as reading the
 * `language` localStorage key directly: Obsidian writes that key only when the
 * user explicitly picks a language in Settings → About → Language, and leaves
 * it absent when the language is inferred from the OS. `getLanguage()` supplies
 * exactly that missing fallback — `localStorage.getItem("language")` first,
 * then `navigator.language` narrowed to a supported code, then `"en"`.
 *
 * Everything below the first branch is defence for contexts that are not a
 * live Obsidian renderer (the Node test pilots have no `window`, and
 * `localStorage` can throw outright). Every such case is English.
 */
function detectLang(): Lang {
  // 1. The supported API. Returns e.g. "ja", "en", "en-GB", "pt-BR" — or, if
  //    the user loaded a custom translation file, an absolute path.
  try {
    const code = normalise(getLanguage());
    if (code) return code;
  } catch {
    /* not a renderer, or the API is unavailable — fall through */
  }

  // 2. Pre-1.8.7 shape, and a direct read in case the import above is absent.
  //    Global key, not vault-namespaced, stored as a bare string (not JSON) —
  //    so never route this through `app.loadLocalStorage`.
  try {
    if (typeof window !== "undefined") {
      const code = normalise(window.localStorage?.getItem("language"));
      if (code) return code;
    }
  } catch {
    /* localStorage can throw; ignore */
  }

  // 3. The OS language, which is what Obsidian itself falls back to.
  try {
    if (typeof navigator !== "undefined") {
      const code = normalise(navigator.language);
      if (code) return code;
    }
  } catch {
    /* ignore */
  }

  return "en";
}

/**
 * An Obsidian language code, or an OS locale, narrowed to a language we ship.
 *
 * Returns null rather than "en" so callers can tell "not Japanese" from "no
 * answer here, try the next source".
 */
function normalise(raw: string | null | undefined): Lang | null {
  if (!raw) return null;

  // A custom translation file is stored in the same slot as a language code.
  // Its path may well contain "ja" by accident, so reject paths outright.
  if (raw.includes("/") || raw.includes("\\")) return null;

  // "ja" | "ja-JP" | "ja_JP" -> "ja". Obsidian's own codes are already bare
  // except en-GB / pt-BR / zh-TW, none of which we ship.
  const base = raw.toLowerCase().split(/[-_]/)[0];

  if (base === "ja") return "ja";
  if (base === "en") return "en";
  return null;
}
```

### Why this shape

- **`getLanguage()` first, unconditionally.** It is the only reading that is *defined* to be the
  app's display language, it is `@public` and `@since 1.8.7`
  (`node_modules/obsidian/obsidian.d.ts:3334`), and our `minAppVersion` is `1.13.0` — so no feature
  detection, no `typeof getLanguage === "function"` dance. It is also precisely the function whose
  fallback half we were missing (§1.2), which is the actual fix.
- **Still reading localStorage, second.** Costs three lines and covers a stale or oddly-packaged
  host where the named import did not resolve. Kept *below* `getLanguage()`, not above, because on
  this machine it returns `null` while `getLanguage()` returns `"ja"`.
- **`navigator.language` third.** This is a deliberate belt-and-braces duplicate of Obsidian's own
  `fd()`. If both of the above somehow fail, matching what Obsidian would have inferred is a strictly
  better guess than defaulting to English.
- **Region stripping.** `getLanguage()` returns `navigator.language` verbatim when it is an exact
  list member, so `"en-GB"` is a real possible value today and `"ja-JP"` becomes possible the moment
  step 3 is reached. Splitting on `[-_]` handles Obsidian codes, BCP-47 tags and POSIX locales in
  one line.
- **Rejecting paths.** `getLanguage()` genuinely can return a filesystem path (§4). Without the
  guard, a user with `/Users/jane/ja.json` would be misdetected. Cheap to exclude.
- **`normalise` returns `null`, not `"en"`.** This is the load-bearing detail. If it returned `"en"`
  on an unknown code, the first source would always "succeed" and the later fallbacks would be dead
  code. Distinguishing "definitely not Japanese" from "no answer" is what makes the chain work.
- **Every access stays inside `try/catch`, and `typeof window` / `typeof navigator` guards stay.**
  Obsidian wraps its own `localStorage` access the same way (§1.6), and our Node test pilots have
  no `window`. All of those paths are English, which is the correct answer for them.
- **`moment.locale()` is deliberately NOT used.** It tracks the app language but through a rewriting
  map (`zh` → `zh-cn`, `no` → `nb`), it is set inside a silent `try/catch`, it silently no-ops when
  a locale bundle is missing, and any other plugin can overwrite it globally (§2.2). It would add a
  failure mode, not remove one.

### Also worth fixing while in the file

`languageDesc` in both `en` and `ja` says the language lives under **Settings → General**. In
Obsidian 1.13.x the setting key is `setting.about.option-language` — it is under **Settings →
About** (§6). Suggested: "…(English unless you have changed it in Settings → About)" and
「…（設定 → About で変更していなければ英語です）」.

### Verifying the fix on this machine

No rebuild needed to confirm the premise — in Obsidian's developer console (Cmd+Opt+I):

```js
localStorage.getItem("language")   // -> null          (the bug)
require("obsidian").getLanguage()  // -> "ja"          (the fix)
navigator.language                 // -> "ja-JP"       (the source)
```

A stronger regression test: in Settings → About → Language, switch to English and back to 日本語.
That calls `dd()` and **writes** the key, after which the old code would start working — which is
exactly why this bug is invisible to any developer who has ever touched the dropdown, and why it
should be tested on a profile that has not.

---

## Appendix: source index

| Claim | Source |
| --- | --- |
| `getLanguage()` signature, `@since 1.8.7` | `node_modules/obsidian/obsidian.d.ts:3329-3334` |
| `getLanguage()` official docs | https://docs.obsidian.md/Reference/TypeScript+API/getLanguage |
| `moment` re-export | `node_modules/obsidian/obsidian.d.ts:8`, `:4519` |
| `App` members (no language field) | `node_modules/obsidian/obsidian.d.ts:406-480` |
| `App.loadLocalStorage` / `saveLocalStorage` | `node_modules/obsidian/obsidian.d.ts:467-480` |
| `od="language"`, `ad="en"`, `sd`, `pd`, `dd`, `fd`, `Kp` | `obsidian-1.13.7.asar` → `app.js` (quoted above) |
| Live localStorage key dump, origin `app://obsidian.md` | `~/Library/Application Support/obsidian/Local Storage/leveldb/` |
| Language codes (`ja`, `zh-TW`, `pt-BR`, `en-GB`) | https://github.com/obsidianmd/obsidian-translations + asar `/i18n/*.txt` |
| Settings location `setting.about.option-language` | `obsidian-1.13.7.asar` → `/i18n/mapping.txt:325` |
| obsidian-tasks uses `getLanguage()` | https://github.com/obsidian-tasks-group/obsidian-tasks/blob/main/src/i18n/i18n.ts |
| excalidraw uses `getLanguage()` | https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/src/constants/constants.ts |
| linter uses `getLanguage()` + moment map | https://github.com/platers/obsidian-linter/blob/master/src/main.ts |
| kanban still uses raw localStorage | https://github.com/mgmeyers/obsidian-kanban/blob/main/src/lang/helpers.ts |
| periodic-notes legacy / moment override | https://github.com/liamcain/obsidian-periodic-notes/blob/main/src/settings/localization.ts |
| macOS system language | `defaults read -g AppleLanguages` → `("ja-JP", "en-JP", "zh-Hans-JP")` |
