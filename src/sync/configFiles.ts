/**
 * Vault 内の設定ファイル（ADR-0006）。clone が成功した直後に、無いものだけ作る。
 *
 * `_Sync/` は同期されるので、最初の一人が作ったものがチーム全員に配られる。中身は
 * 英語で固定する。`_SyncLocal/` は配られないので、各自の UI 言語で作る。
 */
export const SYNC_DIR = "_Sync";
export const SYNC_LOCAL_DIR = "_SyncLocal";

export const TEAM_IGNORE_PATH = `${SYNC_DIR}/ignore.md`;
export const TEAM_README_PATH = `${SYNC_DIR}/README.md`;
export const LOCAL_IGNORE_PATH = `${SYNC_LOCAL_DIR}/ignore.md`;

/**
 * 共有される説明は英語で固定する（ADR-0006）。
 *
 * 説明の行はすべて `#` で始める。このファイルの読み手は Markdown ではなく
 * `parseIgnore` であり、そこでは `#` で始まらない行がすべて規則になる。Markdown の
 * 散文として書くと、説明の一行一行が規則として登録される。
 */
export const TEAM_IGNORE_TEMPLATE = `# Shared ignore rules — paths that are never synced, for anyone on the team.
#
# This file is itself synced, so the whole team gets the same rules.
#
# Ignoring is not deleting. A file that is already synced and later matches a
# rule stays where it is on both sides. It simply stops being synced.
#
# Lines starting with "#" are comments, and blank lines are skipped.
# Every other line is a rule, including a sentence you meant as a note.
#
# Syntax (a subset of .gitignore):
#
#   *       matches within one path segment
#   **      crosses folders
#   ?       one character
#   /foo    anchored to the sync root
#   foo/    folders only, and everything inside them
#   !foo    un-ignores what an earlier rule matched
#
# Later rules win. _SyncLocal/ is always ignored, and _Sync/ignore.md can
# never be ignored.
#
# Write one rule per line below.

Drafts/
`;

export const TEAM_README_TEMPLATE = `# Google Drive Sync

This vault is synced with a Google Drive folder through the "Google Drive Sync
(Internal Use)" plugin. Everyone on the team points the plugin at the same Drive
folder.

## The two config folders

- \`_Sync/\` is synced. Rules here apply to the whole team.
  - \`ignore.md\` — paths that are never synced.
- \`_SyncLocal/\` is never synced. It only exists in your own vault.
  - \`ignore.md\` — paths you alone do not want synced.

## How syncing works here

- Your changes are uploaded as they happen; other people's changes arrive on a timer.
- Deleting is never permanent: files go to the trash on both sides.
- If the plugin is unsure that its record of the last sync still matches reality,
  it holds uploads and tells you why in the sync manager. Downloads keep working.
- "Pull from Drive" brings the remote copy here without deleting anything local.
  Files you have that Drive does not are listed in the sync manager, where you
  decide one by one whether to share or delete them. Until you decide, they are
  not uploaded.
`;

/**
 * 説明として渡された文を、そのまま規則にしないための一手間。空行も `#` にする——
 * 素の空行は読み飛ばされるが、翻訳が段落を含んでも扱いが変わらない方がよい。
 */
function commentOut(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `# ${line.trim()}` : "#"))
    .join("\n");
}

/**
 * 各自の除外ファイル。中身は利用者の UI 言語で作るので、説明の文面は翻訳から来る。
 * 翻訳者が `#` を付け忘れても規則にならないよう、ここで必ず付ける。
 */
export function localIgnoreTemplate(labels: { title: string; body: string }): string {
  return `${commentOut(labels.title)}\n#\n${commentOut(labels.body)}\n`;
}
