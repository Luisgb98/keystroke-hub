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
  // A `select().from()` chain is awaitable with or without a `.where()` in
  // between (e.g. `addTemplateItem`'s "every row" query has no `where` at
  // all), so results are served from one FIFO queue regardless of how many
  // chain links precede the `await` — mirrors `lib/data/idea-event-links.test.ts`'s
  // `makeChain` precedent.
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

  const insertValues = vi.fn(() => Promise.resolve());
  const updateSet = vi.fn();
  const updateReturning = vi.fn();
  const deleteReturning = vi.fn();
  const batch = vi.fn((queries: unknown[]) => Promise.all(queries));

  return {
    selectQueue,
    insertValues,
    updateSet,
    updateReturning,
    deleteReturning,
    batch,
    select: vi.fn(() => ({ from: vi.fn(() => makeSelectChain()) })),
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

const getTemplateItemsMock = vi.hoisted(() => vi.fn());
const searchAttachableEventsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/streams", () => ({
  getTemplateItems: getTemplateItemsMock,
  searchAttachableEvents: searchAttachableEventsMock,
}));

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import {
  addChecklistItem,
  addTemplateItem,
  attachEventToStream,
  createStream,
  deleteStream,
  detachEventFromStream,
  removeChecklistItem,
  removeTemplateItem,
  saveRetroNotes,
  searchAttachableEvents,
  toggleChecklistItem,
  updateStreamDetails,
} from "./stream-actions";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  getTemplateItemsMock.mockResolvedValue([]);
  dbMock.updateReturning.mockResolvedValue([{ id: "stream-1" }]);
  dbMock.deleteReturning.mockResolvedValue([{ id: "stream-1" }]);
});

afterEach(() => {
  dbMock.selectQueue.length = 0;
  vi.clearAllMocks();
});

describe("createStream", () => {
  const validForm = { title: "Boss rush stream", notes: "", planned: "false" };

  it("verifies the session before touching the database", async () => {
    await createStream(undefined, form(validForm));
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated call before writing", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(createStream(undefined, form(validForm))).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("inserts an unscheduled stream directly (no batch) when there's no template", async () => {
    const state = await createStream(undefined, form(validForm));
    expect(state.success).toBe(true);
    expect(state.streamId).toBeTruthy();
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    expect(dbMock.batch).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/content/streams");
  });

  it("snapshots the current template into per-stream checklist items via a batch insert", async () => {
    getTemplateItemsMock.mockResolvedValue([
      { id: "t-1", label: "Check mic", position: 0 },
      { id: "t-2", label: "Test scene", position: 1 },
    ]);

    await createStream(undefined, form(validForm));

    expect(dbMock.batch).toHaveBeenCalledTimes(1);
    const [queries] = dbMock.batch.mock.calls[0];
    expect(queries).toHaveLength(2);
  });

  it("creates a content-track event and the stream together when planned", async () => {
    await createStream(
      undefined,
      form({
        ...validForm,
        planned: "true",
        date: "2026-08-01",
        time: "19:00",
      })
    );

    expect(dbMock.batch).toHaveBeenCalledTimes(1);
    const [queries] = dbMock.batch.mock.calls[0];
    expect(queries).toHaveLength(2);
  });

  it("returns field errors without writing when the title is blank", async () => {
    const state = await createStream(
      undefined,
      form({ ...validForm, title: "" })
    );
    expect(state.error).toBe("Check the highlighted fields.");
    expect(state.fieldErrors?.title).toBeTruthy();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("returns a field error when planned but missing a date", async () => {
    const state = await createStream(
      undefined,
      form({ ...validForm, planned: "true", time: "19:00" })
    );
    expect(state.fieldErrors?.date).toBeTruthy();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe("updateStreamDetails", () => {
  const validForm = { id: "stream-1", title: "Renamed", notes: "" };

  it("verifies the session before writing", async () => {
    await updateStreamDetails(undefined, form(validForm));
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("updates title and notes and revalidates", async () => {
    const result = await updateStreamDetails(undefined, form(validForm));
    expect(result).toEqual({ success: true, streamId: "stream-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/content/streams/stream-1");
  });

  it("returns an error (not a throw) when the stream no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await updateStreamDetails(undefined, form(validForm));
    expect(result.error).toBe("That stream no longer exists.");
  });
});

describe("saveRetroNotes", () => {
  it("verifies the session before writing", async () => {
    await saveRetroNotes("stream-1", "Went well");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("saves retro notes and revalidates the stream page", async () => {
    const result = await saveRetroNotes("stream-1", "Went well");
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({ retroNotes: "Went well" });
    expect(revalidatePath).toHaveBeenCalledWith("/content/streams/stream-1");
  });

  it("clears retro notes with an empty string", async () => {
    await saveRetroNotes("stream-1", "");
    expect(dbMock.updateSet).toHaveBeenCalledWith({ retroNotes: null });
  });

  it("returns an error when the stream no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await saveRetroNotes("missing", "note");
    expect(result).toEqual({ error: "That stream no longer exists." });
  });
});

describe("deleteStream", () => {
  it("verifies the session before deleting", async () => {
    await deleteStream("stream-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("deletes and revalidates the list", async () => {
    const result = await deleteStream("stream-1");
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/content/streams");
  });

  it("returns an error when the stream no longer exists", async () => {
    dbMock.deleteReturning.mockResolvedValueOnce([]);
    const result = await deleteStream("missing");
    expect(result).toEqual({ error: "That stream no longer exists." });
  });
});

describe("toggleChecklistItem", () => {
  it("verifies the session before writing", async () => {
    await toggleChecklistItem("stream-1", "item-1", true);
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — toggling to the same value succeeds without error", async () => {
    dbMock.updateReturning.mockResolvedValue([{ id: "item-1" }]);
    const first = await toggleChecklistItem("stream-1", "item-1", true);
    const second = await toggleChecklistItem("stream-1", "item-1", true);
    expect(first).toEqual({});
    expect(second).toEqual({});
  });

  it("returns an error when the item no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await toggleChecklistItem("stream-1", "missing", true);
    expect(result).toEqual({ error: "That checklist item no longer exists." });
  });
});

describe("addChecklistItem", () => {
  it("verifies the session before writing", async () => {
    dbMock.selectQueue.push([{ id: "stream-1" }]);
    await addChecklistItem("stream-1", "Check mic");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("appends at the next position after the current max", async () => {
    dbMock.selectQueue.push([{ id: "stream-1" }]);
    dbMock.selectQueue.push([{ position: 0 }, { position: 1 }]);

    await addChecklistItem("stream-1", "Check mic");

    expect(dbMock.insertValues).toHaveBeenCalledWith({
      streamId: "stream-1",
      label: "Check mic",
      position: 2,
    });
  });

  it("rejects a blank label without writing", async () => {
    const result = await addChecklistItem("stream-1", "   ");
    expect(result.error).toBeTruthy();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("returns an error when the stream no longer exists", async () => {
    dbMock.selectQueue.push([]);
    const result = await addChecklistItem("missing", "Check mic");
    expect(result).toEqual({ error: "That stream no longer exists." });
  });
});

describe("removeChecklistItem", () => {
  it("verifies the session and deletes scoped by streamId", async () => {
    await removeChecklistItem("stream-1", "item-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
  });
});

describe("addTemplateItem / removeTemplateItem", () => {
  it("appends a template item at the next position", async () => {
    dbMock.selectQueue.push([{ position: 0 }]);
    await addTemplateItem("Test scene");
    expect(dbMock.insertValues).toHaveBeenCalledWith({
      label: "Test scene",
      position: 1,
    });
  });

  it("rejects a blank template label without writing", async () => {
    const result = await addTemplateItem("");
    expect(result.error).toBeTruthy();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("removes a template item and revalidates", async () => {
    const result = await removeTemplateItem("t-1");
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/content/streams");
  });
});

describe("attachEventToStream", () => {
  it("verifies the session before writing", async () => {
    dbMock.selectQueue.push([{ id: "stream-1" }]);
    dbMock.selectQueue.push([{ id: "evt-1", track: "content" }]);
    dbMock.selectQueue.push([]);
    await attachEventToStream("stream-1", "evt-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("attaches a content-track event not claimed by any stream", async () => {
    dbMock.selectQueue.push([{ id: "stream-1" }]);
    dbMock.selectQueue.push([{ id: "evt-1", track: "content" }]);
    dbMock.selectQueue.push([]);

    const result = await attachEventToStream("stream-1", "evt-1");

    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      eventId: "evt-1",
      eventTrack: "content",
    });
  });

  it("rejects a work-track event", async () => {
    dbMock.selectQueue.push([{ id: "stream-1" }]);
    dbMock.selectQueue.push([{ id: "evt-1", track: "work" }]);

    const result = await attachEventToStream("stream-1", "evt-1");

    expect(result).toEqual({
      error: "Only content-track events can attach to a stream.",
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("rejects an event already attached to another stream", async () => {
    dbMock.selectQueue.push([{ id: "stream-1" }]);
    dbMock.selectQueue.push([{ id: "evt-1", track: "content" }]);
    dbMock.selectQueue.push([{ id: "other-stream" }]);

    const result = await attachEventToStream("stream-1", "evt-1");

    expect(result).toEqual({
      error: "That event is already attached to another stream.",
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("returns an error when the stream no longer exists", async () => {
    dbMock.selectQueue.push([]);
    const result = await attachEventToStream("missing", "evt-1");
    expect(result).toEqual({ error: "That stream no longer exists." });
  });
});

describe("detachEventFromStream", () => {
  it("nulls out both eventId and eventTrack", async () => {
    const result = await detachEventFromStream("stream-1");
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      eventId: null,
      eventTrack: null,
    });
  });

  it("returns an error when the stream no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await detachEventFromStream("missing");
    expect(result).toEqual({ error: "That stream no longer exists." });
  });
});

describe("searchAttachableEvents", () => {
  it("verifies the session before querying", async () => {
    searchAttachableEventsMock.mockResolvedValue([]);
    await searchAttachableEvents("");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("delegates to the data-layer query with the same argument", async () => {
    searchAttachableEventsMock.mockResolvedValue([{ id: "evt-1" }]);
    const result = await searchAttachableEvents("stream night");
    expect(searchAttachableEventsMock).toHaveBeenCalledWith("stream night");
    expect(result).toEqual([{ id: "evt-1" }]);
  });
});
