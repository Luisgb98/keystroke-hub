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
vi.mock("@/lib/data/meeting-notes", () => ({
  searchAttachableEvents: vi.fn(),
  searchLinkableImprovements: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
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
  const deleteWhere = vi.fn();
  const deleteReturning = vi.fn();

  return {
    selectQueue,
    insertValues,
    updateSet,
    updateReturning,
    deleteWhere,
    deleteReturning,
    select: vi.fn(() => ({ from: vi.fn(() => makeSelectChain()) })),
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({
      set: vi.fn((values) => {
        updateSet(values);
        return { where: vi.fn(() => ({ returning: updateReturning })) };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn((cond) => {
        deleteWhere(cond);
        return { returning: deleteReturning };
      }),
    })),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: () => dbMock,
}));

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import {
  searchAttachableEvents as searchAttachableEventsQuery,
  searchLinkableImprovements as searchLinkableImprovementsQuery,
} from "@/lib/data/meeting-notes";
import {
  attachEventToMeetingNote,
  createMeetingNote,
  deleteMeetingNote,
  detachEventFromMeetingNote,
  linkImprovementToMeetingNote,
  searchAttachableEvents,
  searchLinkableImprovements,
  unlinkImprovementFromMeetingNote,
  updateMeetingNoteDetails,
} from "./actions";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  dbMock.updateReturning.mockResolvedValue([{ id: "meeting-1" }]);
  dbMock.deleteReturning.mockResolvedValue([
    { id: "meeting-1", projectId: null },
  ]);
});

afterEach(() => {
  dbMock.selectQueue.length = 0;
  vi.clearAllMocks();
});

describe("createMeetingNote", () => {
  const validForm = {
    date: "2026-07-12",
    title: "Weekly sync",
    notes: "Discussed the roadmap.",
  };

  it("verifies the session before writing", async () => {
    await createMeetingNote(undefined, form(validForm));
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("creates a meeting note and revalidates the list", async () => {
    const state = await createMeetingNote(undefined, form(validForm));
    expect(state.success).toBe(true);
    expect(state.meetingNoteId).toBeTruthy();
    expect(revalidatePath).toHaveBeenCalledWith("/projects/meetings");
  });

  it("returns field errors without writing when the title is blank", async () => {
    const state = await createMeetingNote(
      undefined,
      form({ ...validForm, title: "" })
    );
    expect(state.error).toBe("Check the highlighted fields.");
    expect(state.fieldErrors?.title).toBeTruthy();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects linking to an archived project without writing", async () => {
    dbMock.selectQueue.push([
      { id: "project-1", archivedAt: new Date("2026-01-01T00:00:00Z") },
    ]);
    const state = await createMeetingNote(
      undefined,
      form({ ...validForm, projectId: "project-1" })
    );
    expect(state.error).toBe("Archived projects can't take new links.");
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe("updateMeetingNoteDetails", () => {
  const validForm = {
    id: "meeting-1",
    date: "2026-07-12",
    title: "Renamed",
    notes: "Updated notes.",
  };

  beforeEach(() => {
    dbMock.selectQueue.push([{ projectId: null }]);
  });

  it("verifies the session before writing", async () => {
    await updateMeetingNoteDetails(undefined, form(validForm));
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("updates the meeting note and revalidates", async () => {
    const result = await updateMeetingNoteDetails(undefined, form(validForm));
    expect(result).toEqual({ success: true, meetingNoteId: "meeting-1" });
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      date: "2026-07-12",
      title: "Renamed",
      meetingType: "other",
      notes: "Updated notes.",
      reflection: null,
      projectId: null,
    });
  });

  it("returns an error (not a throw) when the meeting note no longer exists", async () => {
    dbMock.selectQueue.length = 0;
    dbMock.selectQueue.push([]);
    const result = await updateMeetingNoteDetails(undefined, form(validForm));
    expect(result.error).toBe("That meeting note no longer exists.");
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("deleteMeetingNote", () => {
  it("verifies the session before deleting", async () => {
    await deleteMeetingNote("meeting-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("deletes and revalidates the list", async () => {
    const result = await deleteMeetingNote("meeting-1");
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/projects/meetings");
  });

  it("returns an error when the meeting note no longer exists", async () => {
    dbMock.deleteReturning.mockResolvedValueOnce([]);
    const result = await deleteMeetingNote("missing");
    expect(result).toEqual({ error: "That meeting note no longer exists." });
  });
});

describe("attachEventToMeetingNote", () => {
  it("verifies the session first", async () => {
    dbMock.selectQueue.push([{ id: "meeting-1" }]);
    dbMock.selectQueue.push([{ id: "event-1", track: "work" }]);
    dbMock.selectQueue.push([]);
    await attachEventToMeetingNote("meeting-1", "event-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects a content-track event", async () => {
    dbMock.selectQueue.push([{ id: "meeting-1" }]);
    dbMock.selectQueue.push([{ id: "event-1", track: "content" }]);
    const result = await attachEventToMeetingNote("meeting-1", "event-1");
    expect(result.error).toBe(
      "Only work-track events can attach to a meeting note."
    );
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("rejects an event already attached to another meeting note", async () => {
    dbMock.selectQueue.push([{ id: "meeting-1" }]);
    dbMock.selectQueue.push([{ id: "event-1", track: "work" }]);
    dbMock.selectQueue.push([{ id: "meeting-2" }]);
    const result = await attachEventToMeetingNote("meeting-1", "event-1");
    expect(result.error).toBe(
      "That event is already attached to another meeting note."
    );
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("attaches a valid work-track event", async () => {
    dbMock.selectQueue.push([{ id: "meeting-1" }]);
    dbMock.selectQueue.push([{ id: "event-1", track: "work" }]);
    dbMock.selectQueue.push([]);
    const result = await attachEventToMeetingNote("meeting-1", "event-1");
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      eventId: "event-1",
      eventTrack: "work",
    });
  });
});

describe("detachEventFromMeetingNote", () => {
  it("clears the event link", async () => {
    const result = await detachEventFromMeetingNote("meeting-1");
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      eventId: null,
      eventTrack: null,
    });
  });

  it("returns an error when the meeting note no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await detachEventFromMeetingNote("missing");
    expect(result).toEqual({ error: "That meeting note no longer exists." });
  });
});

describe("linkImprovementToMeetingNote", () => {
  it("inserts a join row when not already linked", async () => {
    dbMock.selectQueue.push([{ id: "improvement-1" }]);
    dbMock.selectQueue.push([]);
    const result = await linkImprovementToMeetingNote(
      "meeting-1",
      "improvement-1"
    );
    expect(result).toEqual({});
    expect(dbMock.insert).toHaveBeenCalled();
  });

  it("is idempotent when already linked", async () => {
    dbMock.selectQueue.push([{ id: "improvement-1" }]);
    dbMock.selectQueue.push([{ meetingNoteId: "meeting-1" }]);
    const result = await linkImprovementToMeetingNote(
      "meeting-1",
      "improvement-1"
    );
    expect(result).toEqual({});
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects an unknown improvement", async () => {
    dbMock.selectQueue.push([]);
    const result = await linkImprovementToMeetingNote("meeting-1", "missing");
    expect(result.error).toBe("That improvement no longer exists.");
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe("unlinkImprovementFromMeetingNote", () => {
  it("deletes the join row", async () => {
    const result = await unlinkImprovementFromMeetingNote(
      "meeting-1",
      "improvement-1"
    );
    expect(result).toEqual({});
    expect(dbMock.delete).toHaveBeenCalled();
  });
});

describe("searchAttachableEvents", () => {
  it("verifies the session then delegates to the data layer", async () => {
    vi.mocked(searchAttachableEventsQuery).mockResolvedValue([]);
    await searchAttachableEvents("standup");
    expect(verifySession).toHaveBeenCalledTimes(1);
    expect(searchAttachableEventsQuery).toHaveBeenCalledWith("standup");
  });
});

describe("searchLinkableImprovements", () => {
  it("verifies the session then delegates to the data layer", async () => {
    vi.mocked(searchLinkableImprovementsQuery).mockResolvedValue([]);
    await searchLinkableImprovements("meeting-1", "changelog");
    expect(verifySession).toHaveBeenCalledTimes(1);
    expect(searchLinkableImprovementsQuery).toHaveBeenCalledWith(
      "meeting-1",
      "changelog"
    );
  });
});
