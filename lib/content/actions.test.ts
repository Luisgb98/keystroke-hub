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
// `after` runs its callback inline here so we can assert on the sync pushes it
// schedules (the real `after` defers past the response — see docs/google-sync.md).
vi.mock("next/server", () => ({
  after: vi.fn((fn: () => unknown) => {
    fn();
  }),
}));
vi.mock("@/lib/sync/push", () => ({
  pushEventCreated: vi.fn(),
  pushEventUpdated: vi.fn(),
  pushEventDeleted: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
  // A `select().from().where()` chain is awaitable directly; results are drawn
  // from `selectQueue` in FIFO order (mirrors `stream-actions.test.ts`).
  const selectQueue: unknown[][] = [];
  function nextSelect(): Promise<unknown[]> {
    return Promise.resolve(selectQueue.shift() ?? []);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeSelectChain(): any {
    const chain = {
      where: vi.fn(() => chain),
      then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
        nextSelect().then(resolve, reject),
    };
    return chain;
  }

  const insertValues = vi.fn();
  const insertReturning = vi.fn();
  const updateSet = vi.fn();
  const updateReturning = vi.fn();
  const deleteReturning = vi.fn();

  return {
    selectQueue,
    insertValues,
    insertReturning,
    updateSet,
    updateReturning,
    deleteReturning,
    select: vi.fn(() => ({ from: vi.fn(() => makeSelectChain()) })),
    // insert(table).values(v) is awaitable AND exposes `.returning()`.
    insert: vi.fn(() => ({
      values: vi.fn((v) => {
        insertValues(v);
        return {
          returning: vi.fn(() => insertReturning()),
          then: (resolve: () => void, reject?: (e: unknown) => void) =>
            Promise.resolve().then(resolve, reject),
        };
      }),
    })),
    // update(table).set(v).where(...) is awaitable AND exposes `.returning()`.
    update: vi.fn(() => ({
      set: vi.fn((v) => {
        updateSet(v);
        return {
          where: vi.fn(() => ({
            returning: vi.fn(() => updateReturning()),
            then: (resolve: () => void, reject?: (e: unknown) => void) =>
              Promise.resolve().then(resolve, reject),
          })),
        };
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
import {
  pushEventCreated,
  pushEventDeleted,
  pushEventUpdated,
} from "@/lib/sync/push";
import {
  createIdea,
  deleteIdea,
  updateIdea,
  updateIdeaStatus,
} from "./actions";

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
  dbMock.insertReturning.mockResolvedValue([{ id: "idea-new" }]);
  dbMock.updateReturning.mockResolvedValue([{ id: "idea-1" }]);
  dbMock.deleteReturning.mockResolvedValue([{ id: "idea-1" }]);
});

afterEach(() => {
  vi.clearAllMocks();
  dbMock.selectQueue.length = 0;
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

  it("inserts a title-only idea with defaults and revalidates the list and board", async () => {
    const state = await createIdea(undefined, form(validCaptureForm));
    expect(state).toEqual({ success: true });
    expect(dbMock.insertValues).toHaveBeenCalledWith({
      title: "Speedrun any% commentary",
      notes: null,
      format: "either",
      tags: [],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/content/ideas");
    expect(revalidatePath).toHaveBeenCalledWith("/content/board");
    // No release -> the calendar isn't touched.
    expect(revalidatePath).not.toHaveBeenCalledWith("/calendar");
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

  it("saves a captured script against the new idea", async () => {
    await createIdea(
      undefined,
      form({ ...validCaptureForm, script: "# Intro\n\nSay hi" })
    );
    expect(dbMock.insertValues).toHaveBeenCalledWith({
      ideaId: "idea-new",
      content: "# Intro\n\nSay hi",
    });
  });

  it("creates the release event, links it, points the idea at it, and syncs", async () => {
    dbMock.insertReturning
      .mockResolvedValueOnce([{ id: "idea-1" }]) // the idea
      .mockResolvedValueOnce([{ id: "evt-1" }]); // the release event

    const state = await createIdea(
      undefined,
      form({
        ...validCaptureForm,
        releaseDate: "2026-08-01",
        releaseTime: "19:00",
      })
    );

    expect(state).toEqual({ success: true });
    // Release event on the content track, timed, titled from the idea.
    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        track: "content",
        title: "Release: Speedrun any% commentary",
        allDay: false,
        startsAt: new Date("2026-08-01T19:00:00"),
      })
    );
    // Linked, and the idea points at the event.
    expect(dbMock.insertValues).toHaveBeenCalledWith({
      ideaId: "idea-1",
      eventId: "evt-1",
      eventTrack: "content",
    });
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      releaseEventId: "evt-1",
      releaseEventTrack: "content",
    });
    expect(pushEventCreated).toHaveBeenCalledWith("evt-1", "content");
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
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

  it("returns a field error when more than five tags are given", async () => {
    const state = await createIdea(
      undefined,
      form({ ...validCaptureForm, tags: "a, b, c, d, e, f" })
    );
    expect(state.fieldErrors?.tags).toBeTruthy();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe("updateIdea", () => {
  const editForm = {
    title: "Edited title",
    notes: "new notes",
    format: "video",
    tags: "speedrun, glitch",
  };

  it("verifies the session before touching the database", async () => {
    dbMock.selectQueue.push([{ id: "idea-1", releaseEventId: null }]);
    await updateIdea("idea-1", undefined, form(editForm));
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("returns an error (not a throw) when the idea no longer exists", async () => {
    dbMock.selectQueue.push([]); // existing-idea read finds nothing
    const state = await updateIdea("missing", undefined, form(editForm));
    expect(state).toEqual({ error: "That idea no longer exists." });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("updates the core fields and revalidates the list and board", async () => {
    dbMock.selectQueue.push([{ id: "idea-1", releaseEventId: null }]);
    const state = await updateIdea("idea-1", undefined, form(editForm));
    expect(state).toEqual({ success: true });
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      title: "Edited title",
      notes: "new notes",
      format: "video",
      tags: ["speedrun", "glitch"],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/content/ideas");
    expect(revalidatePath).toHaveBeenCalledWith("/content/board");
  });

  it("creates a release event when a date is set on a previously-unscheduled idea", async () => {
    dbMock.selectQueue.push([{ id: "idea-1", releaseEventId: null }]);
    dbMock.insertReturning.mockResolvedValueOnce([{ id: "evt-9" }]);

    await updateIdea(
      "idea-1",
      undefined,
      form({ ...editForm, releaseDate: "2026-09-10", releaseTime: "18:00" })
    );

    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        track: "content",
        startsAt: new Date("2026-09-10T18:00:00"),
      })
    );
    expect(pushEventCreated).toHaveBeenCalledWith("evt-9", "content");
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("rewrites the release event's time span when the date changes", async () => {
    dbMock.selectQueue.push([{ id: "idea-1", releaseEventId: "evt-1" }]);
    dbMock.updateReturning.mockResolvedValue([
      { id: "evt-1", track: "content" },
    ]);

    await updateIdea(
      "idea-1",
      undefined,
      form({ ...editForm, releaseDate: "2026-10-05", releaseTime: "20:00" })
    );

    expect(dbMock.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Release: Edited title",
        startsAt: new Date("2026-10-05T20:00:00"),
      })
    );
    expect(pushEventUpdated).toHaveBeenCalledWith("evt-1", "content");
  });

  it("deletes the release event when the date is cleared", async () => {
    dbMock.selectQueue.push([{ id: "idea-1", releaseEventId: "evt-1" }]);
    dbMock.selectQueue.push([
      { id: "link-1", googleEventId: "g-1", eventId: "evt-1" },
    ]);
    dbMock.deleteReturning.mockResolvedValueOnce([
      { id: "evt-1", track: "content" },
    ]);

    await updateIdea("idea-1", undefined, form(editForm)); // no releaseDate

    expect(dbMock.delete).toHaveBeenCalled();
    expect(pushEventDeleted).toHaveBeenCalledWith("link-1", "g-1", "content");
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("returns field errors without writing when the title is blank", async () => {
    const state = await updateIdea(
      "idea-1",
      undefined,
      form({ ...editForm, title: "" })
    );
    expect(state.fieldErrors?.title).toBeTruthy();
    expect(dbMock.select).not.toHaveBeenCalled();
  });
});

describe("updateIdeaStatus", () => {
  it("verifies the session before touching the database", async () => {
    await updateIdeaStatus("idea-1", "scripted");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated call before writing", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(updateIdeaStatus("idea-1", "scripted")).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("updates the status and revalidates both the list and the board", async () => {
    const result = await updateIdeaStatus("idea-1", "scripted");
    expect(result).toEqual({});
    expect(dbMock.update).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/content/ideas");
    expect(revalidatePath).toHaveBeenCalledWith("/content/board");
  });

  it("sets stageEnteredAt via a conditional SQL expression, not a plain value", async () => {
    await updateIdeaStatus("idea-1", "scripted");
    const [setArgs] = dbMock.updateSet.mock.calls[0];
    expect(setArgs.status).toBe("scripted");
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
    const result = await updateIdeaStatus("missing", "scripted");
    expect(result).toEqual({ error: "That idea no longer exists." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("does not touch the checklist table for an early-stage transition", async () => {
    await updateIdeaStatus("idea-1", "scripted");
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("seeds the four default checklist items on first entry into a late stage", async () => {
    dbMock.selectQueue.push([]); // no existing checklist rows

    const result = await updateIdeaStatus("idea-1", "recorded");

    expect(result).toEqual({});
    expect(dbMock.insertValues).toHaveBeenCalledWith([
      { ideaId: "idea-1", label: "Title", position: 0 },
      { ideaId: "idea-1", label: "Thumbnail", position: 1 },
      { ideaId: "idea-1", label: "Description", position: 2 },
      { ideaId: "idea-1", label: "Tags", position: 3 },
    ]);
  });

  it("does not reseed when the idea already has checklist rows", async () => {
    dbMock.selectQueue.push([{ id: "item-1" }]);

    const result = await updateIdeaStatus("idea-1", "edited");

    expect(result).toEqual({});
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("returns an error without touching the checklist table when the idea no longer exists on a late-stage move", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);

    const result = await updateIdeaStatus("missing", "recorded");

    expect(result).toEqual({ error: "That idea no longer exists." });
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("does not fail the request when seeding the checklist errors (e.g. the idea vanished mid-flight)", async () => {
    dbMock.select.mockImplementationOnce(() => {
      throw new Error("connection reset");
    });

    const result = await updateIdeaStatus("idea-1", "recorded");

    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/content/board");
  });

  it("returns the unchecked count when moving an already-seeded idea to published", async () => {
    dbMock.selectQueue.push([{ id: "item-1" }]); // already seeded
    dbMock.selectQueue.push([
      { done: false },
      { done: true },
      { done: false },
      { done: false },
    ]);

    const result = await updateIdeaStatus("idea-1", "published");

    expect(result).toEqual({ uncheckedCount: 3 });
  });

  it("seeds and returns the full unchecked count when skipping directly to published", async () => {
    dbMock.selectQueue.push([]); // no existing checklist rows -> seeds
    dbMock.selectQueue.push([
      { done: false },
      { done: false },
      { done: false },
      { done: false },
    ]);

    const result = await updateIdeaStatus("idea-1", "published");

    expect(result).toEqual({ uncheckedCount: 4 });
    expect(dbMock.insertValues).toHaveBeenCalledWith([
      { ideaId: "idea-1", label: "Title", position: 0 },
      { ideaId: "idea-1", label: "Thumbnail", position: 1 },
      { ideaId: "idea-1", label: "Description", position: 2 },
      { ideaId: "idea-1", label: "Tags", position: 3 },
    ]);
  });

  it("returns an unchecked count of 0 when every item is already checked", async () => {
    dbMock.selectQueue.push([{ id: "item-1" }]); // already seeded
    dbMock.selectQueue.push([
      { done: true },
      { done: true },
      { done: true },
      { done: true },
    ]);

    const result = await updateIdeaStatus("idea-1", "published");

    expect(result).toEqual({ uncheckedCount: 0 });
  });
});

describe("deleteIdea", () => {
  it("verifies the session before touching the database", async () => {
    dbMock.selectQueue.push([{ releaseEventId: null }]);
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

  it("deletes an existing idea and revalidates the list and board", async () => {
    dbMock.selectQueue.push([{ releaseEventId: null }]);
    const result = await deleteIdea("idea-1");
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/content/ideas");
    expect(revalidatePath).toHaveBeenCalledWith("/content/board");
  });

  it("returns an error (not a throw) when the idea no longer exists", async () => {
    dbMock.selectQueue.push([{ releaseEventId: null }]);
    dbMock.deleteReturning.mockResolvedValueOnce([]);
    const result = await deleteIdea("missing");
    expect(result).toEqual({ error: "That idea no longer exists." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("also deletes the idea's release event and syncs the deletion", async () => {
    dbMock.selectQueue.push([{ releaseEventId: "evt-1" }]); // idea's pointer
    dbMock.selectQueue.push([
      { id: "link-1", googleEventId: "g-1", eventId: "evt-1" },
    ]);
    dbMock.deleteReturning
      .mockResolvedValueOnce([{ id: "idea-1" }]) // the idea
      .mockResolvedValueOnce([{ id: "evt-1", track: "content" }]); // the event

    const result = await deleteIdea("idea-1");

    expect(result).toEqual({});
    expect(dbMock.delete).toHaveBeenCalledTimes(2);
    expect(pushEventDeleted).toHaveBeenCalledWith("link-1", "g-1", "content");
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });
});
