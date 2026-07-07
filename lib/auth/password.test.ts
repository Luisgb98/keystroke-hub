// @vitest-environment node
import { describe, expect, it } from "vitest";

import { hashPassword, hashPasswordSync, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(
      verifyPassword("correct horse battery staple", hash)
    ).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("Tr0ub4dor&3", hash)).resolves.toBe(false);
  });

  it("produces a different hash for the same password (random salt)", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same password"),
      hashPassword("same password"),
    ]);
    expect(a).not.toBe(b);
  });

  it("encodes its parameters in the scrypt.N.r.p.salt.key format", async () => {
    const hash = await hashPassword("whatever");
    expect(hash).toMatch(
      /^scrypt\.16384\.8\.1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/
    );
  });

  it("never contains a literal $ (dotenv-expand in @next/env treats unescaped $ in .env values as $VAR interpolation and silently corrupts them)", async () => {
    const hash = await hashPassword("whatever");
    expect(hash).not.toContain("$");
  });

  it("hashPasswordSync output verifies with verifyPassword", async () => {
    const hash = hashPasswordSync("sync and async agree");
    await expect(verifyPassword("sync and async agree", hash)).resolves.toBe(
      true
    );
  });

  it.each([
    ["empty string", ""],
    ["not our format", "bcrypt.whatever"],
    ["too few segments", "scrypt.16384.8.1.saltonly"],
    ["non-numeric params", "scrypt.abc.8.1.c2FsdA==.a2V5"],
    ["zero cost", "scrypt.0.8.1.c2FsdA==.a2V5"],
    ["empty salt", "scrypt.16384.8.1..a2V5"],
    ["empty key", "scrypt.16384.8.1.c2FsdA==."],
  ])("rejects a malformed hash (%s) without throwing", async (_name, bad) => {
    await expect(verifyPassword("anything", bad)).resolves.toBe(false);
  });
});
