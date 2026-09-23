import { App, FileSystemAdapter, Platform } from "obsidian";
import { execFile, spawn } from "child_process";
import { join } from "path";

/** Vault 相対パスの、OS 上のフルパス。区切り文字は OS に合わせる（Windows は `\`）。 */
export function fullPathOf(app: App, path: string): string | null {
  const adapter = app.vault.adapter;
  return adapter instanceof FileSystemAdapter ? join(adapter.getBasePath(), path) : null;
}

/**
 * テキストエディタで開く。
 *
 * 拡張子の無いファイルは OS の既定アプリが決まらず、Windows では「このファイルを
 * 開く方法」の選択に落ちるので、エディタを名指しする。
 */
export function openInTextEditor(full: string): Promise<void> {
  if (Platform.isMacOS) {
    // `open` はアプリに渡したらすぐ終わるので、終了コードで失敗を拾える。
    return new Promise((resolve, reject) =>
      execFile("open", ["-t", full], (err) => (err ? reject(new Error(err.message)) : resolve()))
    );
  }
  // notepad は閉じるまで終わらないので、起動できたかだけを見て切り離す。
  const [cmd, args] = Platform.isWin ? ["notepad.exe", [full]] : ["xdg-open", [full]];
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
