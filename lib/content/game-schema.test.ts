import { describe, expect, it } from "vitest";

import {
  MAX_GAME_NAME_LENGTH,
  gameCreateSchema,
  gameRenameSchema,
  gameIdFieldSchema,
  normalizeGameName,
  sameGameName,
} from "./game-schema";

describe("normalizeGameName", () => {
  it("trims the ends and collapses internal whitespace", () => {
    expect(normalizeGameName("  Path   of  Exile ")).toBe("Path of Exile");
    expect(normalizeGameName("PoE\tleague")).toBe("PoE league");
  });

  it("preserves casing — the library shows the name as typed", () => {
    expect(normalizeGameName("Path of Exile")).toBe("Path of Exile");
    expect(normalizeGameName("PoE")).toBe("PoE");
  });

  it("returns an empty string for blank or missing input", () => {
    expect(normalizeGameName("   ")).toBe("");
    expect(normalizeGameName("")).toBe("");
    expect(normalizeGameName(undefined)).toBe("");
    expect(normalizeGameName(null)).toBe("");
  });

  it("truncates rather than letting a paste become a library entry", () => {
    expect(normalizeGameName("x".repeat(500))).toHaveLength(
      MAX_GAME_NAME_LENGTH
    );
  });
});

describe("sameGameName", () => {
  it("ignores casing and surrounding or repeated whitespace", () => {
    expect(sameGameName("Path of Exile", "  path of   exile ")).toBe(true);
    expect(sameGameName("PoE", "poe")).toBe(true);
  });

  it("still separates genuinely different games", () => {
    expect(sameGameName("Path of Exile", "Path of Exile 2")).toBe(false);
    expect(sameGameName("Hades", "Hades II")).toBe(false);
  });
});

describe("gameCreateSchema", () => {
  it("normalizes before validating, so a padded name is accepted as trimmed", () => {
    const result = gameCreateSchema.safeParse({ name: "  Elden   Ring  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Elden Ring");
  });

  it("rejects a whitespace-only name as missing, not as a stray space", () => {
    const result = gameCreateSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Name is required");
    }
  });
});

describe("gameRenameSchema", () => {
  it("requires a real id alongside the new name", () => {
    expect(
      gameRenameSchema.safeParse({ id: "not-a-uuid", name: "Hades" }).success
    ).toBe(false);
    expect(
      gameRenameSchema.safeParse({
        id: "1e9d4f5a-2b3c-4d5e-8f90-1a2b3c4d5e6f",
        name: " Hades ",
      }).success
    ).toBe(true);
  });
});

describe("gameIdFieldSchema", () => {
  it("treats an empty field as 'no game' rather than an error", () => {
    expect(gameIdFieldSchema.parse("")).toBeNull();
    expect(gameIdFieldSchema.parse(undefined)).toBeNull();
  });

  it("passes an id straight through — existence is checked at write time", () => {
    expect(gameIdFieldSchema.parse("game-1")).toBe("game-1");
  });
});
