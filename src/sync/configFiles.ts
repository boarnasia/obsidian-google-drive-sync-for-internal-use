/**
 * 同期ルート直下の設定ファイル（ADR-0007）。
 *
 * どちらもドットで始まるので Obsidian のファイル一覧には出ない。規則を Markdown の
 * ノートとして置くと、Obsidian で開いたときに見出しと箇条書きに化けて読めないため、
 * 割り切って素のテキストにした。開く手段はサイドバーに置く。
 */

/** チームで共有する除外規則。普通のファイルとして同期され、全員に配られる。 */
export const TEAM_IGNORE_PATH = ".tds-ignore";

/**
 * チームで使っているプラグインの版。Drive 上にだけ置き、同期はしない。
 * 誰かが新しい版で同期すると上がり、それより古い版の同期は止まる。
 */
export const VERSION_PATH = ".tds-version";

/**
 * 共有される説明は英語で固定する。最初の一人が作ったものが全員に配られるため。
 *
 * 説明の行はすべて `#` で始める。`parseIgnore` は `#` で始まらない行をすべて規則にする。
 */
export const TEAM_IGNORE_TEMPLATE = `# Shared ignore rules (Team Drive Sync) — paths that are never synced, for anyone on the team.
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
#   !foo    un-ignores what an earlier rule matched, but never a file
#           inside an ignored folder
#
# Later rules win. This file itself can never be ignored.
#
# Write one rule per line below.

Drafts/
`;
