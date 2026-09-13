import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * テストは Node 上で走る。`obsidian` は Obsidian 本体が実行時に注入するモジュールで
 * あり、npm の `obsidian` パッケージは型しか持たない——そのままでは import した
 * 時点で落ちる。そこで実装側のコードには手を入れず、ここでモックへ差し替える。
 */
export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(new URL("./tests/helpers/obsidian-mock.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // モックは読み込まれた時点で `window` と `createFragment`（Obsidian のグローバル）を
    // 生やす。これらに触れるのは `obsidian` を import しないモジュール（util/retry など）
    // もあるため、全テストで先に読ませる。
    setupFiles: ["./tests/helpers/obsidian-mock.ts"],
  },
});
