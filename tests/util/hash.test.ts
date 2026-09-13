/*
 * 内容ハッシュ。ローカル側の変更検知と移動の突き合わせがこれに乗っている。
 */
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../../src/util/hash";

const enc = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe("sha256Hex", () => {
  it("既知のベクタと一致する（空入力）", async () => {
    expect(await sha256Hex(new ArrayBuffer(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("既知のベクタと一致する（abc）", async () => {
    expect(await sha256Hex(enc("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("常に 64 桁の小文字 16 進を返す", async () => {
    expect(await sha256Hex(enc("日報"))).toMatch(/^[0-9a-f]{64}$/);
  });

  it("同じ内容は同じハッシュ（別のバッファでも）", async () => {
    expect(await sha256Hex(enc("同じ"))).toBe(await sha256Hex(enc("同じ")));
  });

  it("1 バイト違えば別のハッシュ", async () => {
    expect(await sha256Hex(enc("v1"))).not.toBe(await sha256Hex(enc("v2")));
  });

  it("先頭が 0 のバイトでも桁を落とさない", async () => {
    // 0x00 のバイト列は "00" と 2 桁で出る必要がある（padStart の検証）。
    const hex = await sha256Hex(new Uint8Array([0, 0, 0]).buffer);
    expect(hex).toHaveLength(64);
  });
});
