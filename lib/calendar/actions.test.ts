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
// `after()` requires a real request scope, which vitest's node environment
// doesn't provide — the outbound Google push it schedules is exercised by
// lib/sync/push.test.ts instead, so it's mocked away here entirely.
vi.mock("next/server", () => ({ after: vi.fn((fn: () => unknown) => fn()) }));
vi.mock("@/lib/sync/push", () => ({
  pushEventCreated: vi.fn(),
  pushEventUpdated: vi.fn(),
  pushEventDeleted: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
  const insertReturning = vi.fn();
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const updateReturning = vi.fn();
  const deleteReturning = vi.fn();
  const selectWhere = vi.fn();

  return {
    insertReturning,
    insertValues,
    updateReturning,
    deleteReturning,
    selectWhere,
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: updateReturning })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ returning: deleteReturning })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: selectWhere })),
    })),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: () => dbMock,
}));

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import { createEvent, deleteEvent, updateEvent } from "./actions";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

const validTimedForm = {
  title: "Sprint planning",
  track: "work",
  description: "",
  allDay: "false",
  startDate: "2026-07-08",
  startTime: "09:00",
  endDate: "2026-07-08",
  endTime: "10:00",
};

beforeEach(() => {
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  dbMock.insertReturning.mockResolvedValue([{ id: "evt-1", track: "work" }]);
  dbMock.deleteReturning.mockResolvedValue([{ id: "1", track: "work" }]);
  dbMock.updateReturning.mockResolvedValue([{ id: "evt-1", track: "work" }]);
  // deleteEvent's pre-delete sync-link lookup — no link by default.
  dbMock.selectWhere.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createEvent", () => {
  it("verifies the session before touching the database", async () => {
    await createEvent(undefined, form(validTimedForm));
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated call before writing", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(createEvent(undefined, form(validTimedForm))).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("inserts a valid event and revalidates the calendar", async () => {
    const state = await createEvent(undefined, form(validTimedForm));
    expect(state).toEqual({ success: true });
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sprint planning", track: "work" })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("returns field errors without writing on invalid input", async () => {
    const state = await createEvent(
      undefined,
      form({ ...validTimedForm, title: "" })
    );
    expect(state.error).toBe("Check the highlighted fields.");
    expect(state.fieldErrors?.title).toBeTruthy();
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a field error when no track is chosen", async () => {
    const data = { ...validTimedForm };
    // @ts-expect-error deliberately omitting a required field
    delete data.track;
    const state = await createEvent(undefined, form(data));
    expect(state.fieldErrors?.track).toEqual(["Choose a track"]);
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe("updateEvent", () => {
  it("verifies the session before touching the database", async () => {
    await updateEvent("evt-1", undefined, form(validTimedForm));
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("updates a valid event and revalidates the calendar", async () => {
    const state = await updateEvent("evt-1", undefined, form(validTimedForm));
    expect(state).toEqual({ success: true });
    expect(dbMock.update).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("returns field errors without writing on invalid input", async () => {
    const state = await updateEvent(
      "evt-1",
      undefined,
      form({ ...validTimedForm, endTime: "08:00" })
    );
    expect(state.error).toBe("Check the highlighted fields.");
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("returns an error (not a throw) when updating a nonexistent event", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const state = await updateEvent("missing", undefined, form(validTimedForm));
    expect(state).toEqual({ error: "That event no longer exists." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteEvent", () => {
  it("verifies the session before touching the database", async () => {
    await deleteEvent("evt-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("deletes an existing event and revalidates the calendar", async () => {
    dbMock.deleteReturning.mockResolvedValueOnce([{ id: "evt-1" }]);
    const result = await deleteEvent("evt-1");
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("returns an error (not a throw) when the event no longer exists", async () => {
    dbMock.deleteReturning.mockResolvedValueOnce([]);
    const result = await deleteEvent("missing");
    expect(result).toEqual({ error: "That event no longer exists." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated call before deleting", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(deleteEvent("evt-1")).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(dbMock.delete).not.toHaveBeenCalled();
  });
});
