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

  // 期待値に 0x01 のバイト（"8f01cf" の "01"）があるので、1 桁のバイトを 2 桁に揃えることもここで確かめている。
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
});
