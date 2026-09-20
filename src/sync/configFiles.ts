import { LocalOnlyLabels, renderLocalOnly } from "./localOnly";

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
export const LOCAL_ONLY_PATH = `${SYNC_LOCAL_DIR}/local-only.md`;

/** 共有される説明は英語で固定する（ADR-0006）。 */
export const TEAM_IGNORE_TEMPLATE = `# Shared ignore rules

Files matching these rules are **not synced** for anyone on the team. This file is
itself synced, so everybody gets the same rules.

Ignoring is not deleting. A file that is already synced and later matches a rule
stays where it is on both sides — it simply stops being synced.

Syntax (a subset of \`.gitignore\`):

- Lines starting with \`#\` are comments. Blank lines are ignored.
- \`*\` matches within one path segment, \`**\` crosses folders, \`?\` is one character.
- A leading \`/\` anchors the rule to the sync root.
- A trailing \`/\` matches folders only, and everything inside them.
- \`!\` un-ignores something an earlier rule matched.

\`_SyncLocal/\` is always ignored, and \`_Sync/ignore.md\` can never be ignored.

Write one rule per line below.

Drafts/
*.tmp
`;

export const TEAM_README_TEMPLATE = `# Google Drive Sync

This vault — or the folder mounted as the shared vault — is synced with a Google
Drive folder through the "Google Drive Sync (Internal Use)" plugin. Everyone on
the team points the plugin at the same Drive folder.

## The two config folders

- \`_Sync/\` is synced. Rules here apply to the whole team.
  - \`ignore.md\` — paths that are never synced.
- \`_SyncLocal/\` is never synced. It only exists in your own vault.
  - \`ignore.md\` — paths you alone do not want synced.
  - \`local-only.md\` — files you have that Drive does not, waiting to be sorted.

## How syncing works here

- Your changes are uploaded as they happen; other people's changes arrive on a timer.
- Deleting is never permanent: files go to the trash on both sides.
- If the plugin is unsure that its record of the last sync still matches reality,
  it holds uploads and tells you why in the sync manager. Downloads keep working.
- "Pull from Drive" brings the remote copy here without deleting anything local.
  Files you have that Drive does not are listed in \`_SyncLocal/local-only.md\`.
`;

export function localIgnoreTemplate(labels: { title: string; body: string }): string {
  return `# ${labels.title}\n\n${labels.body}\n`;
}

export function localOnlyTemplate(labels: LocalOnlyLabels): string {
  return renderLocalOnly({ entries: { unsorted: [], shared: [], trash: [] }, unmarked: [] }, labels);
}
