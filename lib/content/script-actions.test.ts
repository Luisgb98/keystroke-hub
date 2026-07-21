// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  verifySession: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
  const selectWhere = vi.fn();
  const insertReturning = vi.fn();
  const onConflictDoUpdate = vi.fn(() => ({ returning: insertReturning }));
  const insertValues = vi.fn(() => ({ onConflictDoUpdate }));

  return {
    selectWhere,
    insertReturning,
    onConflictDoUpdate,
    insertValues,
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: selectWhere })) })),
    insert: vi.fn(() => ({ values: insertValues })),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: () => dbMock,
}));

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import { saveScript } from "./script-actions";

const UPDATED_AT = new Date("2026-07-08T12:00:00Z");

beforeEach(() => {
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  dbMock.selectWhere.mockResolvedValue([{ id: "idea-1" }]);
  dbMock.insertReturning.mockResolvedValue([{ updatedAt: UPDATED_AT }]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("saveScript", () => {
  it("verifies the session before touching the database", async () => {
    await saveScript("idea-1", "hello");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated call before writing", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(saveScript("idea-1", "hello")).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("returns a validation error without writing when content is too long", async () => {
    const result = await saveScript("idea-1", "a".repeat(200_001));
    expect(result.error).toBeTruthy();
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("returns an error (not a throw) when the idea no longer exists", async () => {
    dbMock.selectWhere.mockResolvedValueOnce([]);
    const result = await saveScript("missing", "hello");
    expect(result).toEqual({ error: "That idea no longer exists." });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("upserts keyed on idea_id and returns the new updatedAt", async () => {
    const result = await saveScript("idea-1", "# Script");
    expect(dbMock.insertValues).toHaveBeenCalledWith({
      ideaId: "idea-1",
      content: "# Script",
    });
    expect(dbMock.onConflictDoUpdate).toHaveBeenCalledTimes(1);
    expect(dbMock.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.anything(),
        set: expect.objectContaining({ content: "# Script" }),
      })
    );
    expect(result).toEqual({ updatedAt: UPDATED_AT });
  });

  it("revalidates the script page, ideas list, and board", async () => {
    await saveScript("idea-1", "content");
    expect(revalidatePath).toHaveBeenCalledWith("/content/ideas/idea-1/script");
    expect(revalidatePath).toHaveBeenCalledWith("/content/ideas");
    expect(revalidatePath).toHaveBeenCalledWith("/content/board");
  });
});
