// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  verifySession: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
  const insertValues = vi.fn(() => Promise.resolve());
  const updateSet = vi.fn();
  const updateReturning = vi.fn();
  const deleteReturning = vi.fn();

  return {
    insertValues,
    updateSet,
    updateReturning,
    deleteReturning,
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({
      set: vi.fn((values) => {
        updateSet(values);
        return { where: vi.fn(() => ({ returning: updateReturning })) };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ returning: deleteReturning })),
    })),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: () => dbMock,
}));

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import { createIdea, deleteIdea, updateIdeaStatus } from "./actions";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const validCaptureForm = {
  title: "Speedrun any% commentary",
  notes: "",
  format: "",
  tags: "",
};

beforeEach(() => {
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  dbMock.updateReturning.mockResolvedValue([{ id: "idea-1" }]);
  dbMock.deleteReturning.mockResolvedValue([{ id: "idea-1" }]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createIdea", () => {
  it("verifies the session before touching the database", async () => {
    await createIdea(undefined, form(validCaptureForm));
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated call before writing", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(createIdea(undefined, form(validCaptureForm))).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("inserts a title-only idea with defaults and revalidates the list", async () => {
    const state = await createIdea(undefined, form(validCaptureForm));
    expect(state).toEqual({ success: true });
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    expect(dbMock.insertValues).toHaveBeenCalledWith({
      title: "Speedrun any% commentary",
      notes: null,
      format: "either",
      tags: [],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/content/ideas");
  });

  it("inserts full input with notes, format, and normalized tags", async () => {
    await createIdea(
      undefined,
      form({
        title: "Glitch tutorial",
        notes: "Cover the wrong warp",
        format: "video",
        tags: "Speedrun, glitch, speedrun",
      })
    );
    expect(dbMock.insertValues).toHaveBeenCalledWith({
      title: "Glitch tutorial",
      notes: "Cover the wrong warp",
      format: "video",
      tags: ["speedrun", "glitch"],
    });
  });

  it("returns field errors without writing when the title is blank", async () => {
    const state = await createIdea(
      undefined,
      form({ ...validCaptureForm, title: "" })
    );
    expect(state.error).toBe("Check the highlighted fields.");
    expect(state.fieldErrors?.title).toBeTruthy();
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a field error for an invalid format", async () => {
    const state = await createIdea(
      undefined,
      form({ ...validCaptureForm, format: "podcast" })
    );
    expect(state.fieldErrors?.format).toBeTruthy();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe("updateIdeaStatus", () => {
  it("verifies the session before touching the database", async () => {
    await updateIdeaStatus("idea-1", "outlined");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated call before writing", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(updateIdeaStatus("idea-1", "outlined")).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("updates the status and revalidates both the list and the board", async () => {
    const result = await updateIdeaStatus("idea-1", "outlined");
    expect(result).toEqual({});
    expect(dbMock.update).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/content/ideas");
    expect(revalidatePath).toHaveBeenCalledWith("/content/board");
  });

  it("sets stageEnteredAt via a conditional SQL expression, not a plain value", async () => {
    await updateIdeaStatus("idea-1", "outlined");
    const [setArgs] = dbMock.updateSet.mock.calls[0];
    expect(setArgs.status).toBe("outlined");
    expect(setArgs.stageEnteredAt).toBeTruthy();
    expect(typeof setArgs.stageEnteredAt).toBe("object");
  });

  it("returns an error without writing for an invalid status", async () => {
    const result = await updateIdeaStatus("idea-1", "vibing");
    expect(result).toEqual({ error: "That status isn't valid." });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("returns an error (not a throw) when the idea no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await updateIdeaStatus("missing", "outlined");
    expect(result).toEqual({ error: "That idea no longer exists." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteIdea", () => {
  it("verifies the session before touching the database", async () => {
    await deleteIdea("idea-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated call before deleting", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(deleteIdea("idea-1")).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it("deletes an existing idea and revalidates the list", async () => {
    const result = await deleteIdea("idea-1");
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/content/ideas");
  });

  it("returns an error (not a throw) when the idea no longer exists", async () => {
    dbMock.deleteReturning.mockResolvedValueOnce([]);
    const result = await deleteIdea("missing");
    expect(result).toEqual({ error: "That idea no longer exists." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
