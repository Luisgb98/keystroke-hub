// @vitest-environment node
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decryptToken, encryptToken } from "./crypto";

const originalKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

afterEach(() => {
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = originalKey;
});

describe("token encryption", () => {
  it("round-trips a token", () => {
    const encrypted = encryptToken("ya29.super-secret-access-token");
    expect(decryptToken(encrypted)).toBe("ya29.super-secret-access-token");
  });

  it("produces different ciphertext for the same plaintext (random iv)", () => {
    const a = encryptToken("same token");
    const b = encryptToken("same token");
    expect(a).not.toBe(b);
  });

  it("never contains a literal $ (dotenv-expand corrupts unescaped $ in .env values)", () => {
    const encrypted = encryptToken("token-with-lots-of-entropy");
    expect(encrypted).not.toContain("$");
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptToken("a token");
    const [iv, ciphertext, tag] = encrypted.split(".");
    const tampered = [iv, ciphertext.slice(0, -2) + "AA", tag].join(".");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("throws on malformed input", () => {
    expect(() => decryptToken("not-a-valid-token")).toThrow(
      "Malformed encrypted token."
    );
  });

  it("throws a descriptive error when the key is missing", () => {
    delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    expect(() => encryptToken("token")).toThrow(
      /GOOGLE_TOKEN_ENCRYPTION_KEY is not set/
    );
  });

  it("throws when the key doesn't decode to 32 bytes", () => {
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY =
      Buffer.from("too short").toString("base64");
    expect(() => encryptToken("token")).toThrow(/must decode to 32 bytes/);
  });
});
