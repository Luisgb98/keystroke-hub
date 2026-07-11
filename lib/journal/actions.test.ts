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
  // Same FIFO-queue precedent as `lib/content/stream-actions.test.ts` /
  // `lib/content/link-actions.test.ts`: a `select().from()` chain is
  // awaitable with or without `.where()`/`.orderBy()`/`.limit()` links.
  const selectQueue: unknown[][] = [];
  function nextSelect(): Promise<unknown[]> {
    return Promise.resolve(selectQueue.shift() ?? []);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeSelectChain(): any {
    const chain = {
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
        nextSelect().then(resolve, reject),
    };
    return chain;
  }

  const insertValues = vi.fn(() => Promise.resolve());
  const updateSet = vi.fn();
  const updateReturning = vi.fn(() => Promise.resolve([{ id: "item-1" }]));
  const batch = vi.fn((queries: unknown[]) => Promise.all(queries));

  return {
    selectQueue,
    insertValues,
    updateSet,
    updateReturning,
    batch,
    select: vi.fn(() => ({ from: vi.fn(() => makeSelectChain()) })),
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({
      set: vi.fn((values) => {
        updateSet(values);
        return { where: vi.fn(() => ({ returning: updateReturning })) };
      }),
    })),
    delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: () => dbMock,
}));

const getOrCreateLogMock = vi.hoisted(() => vi.fn());
const nextItemPositionMock = vi.hoisted(() => vi.fn());
const getDayLogMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/daily-logs", () => ({
  getOrCreateLog: getOrCreateLogMock,
  nextItemPosition: nextItemPositionMock,
  getDayLog: getDayLogMock,
}));

const getOrCreateWeeklyReviewMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/weekly-reviews", () => ({
  getOrCreateWeeklyReview: getOrCreateWeeklyReviewMock,
}));

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import {
  addItem,
  deleteItem,
  editItemTitle,
  rolloverAllUnfinished,
  rolloverItem,
  saveAssessmentNote,
  saveHighlights,
  saveMood,
  saveRetro,
  saveWeeklyRating,
  toggleItem,
} from "./actions";

const LOG = { id: "log-1", logDate: "2026-07-08" };
const REVIEW = { id: "review-1", weekStart: "2026-07-06" };

beforeEach(() => {
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  getOrCreateLogMock.mockResolvedValue(LOG);
  nextItemPositionMock.mockResolvedValue(0);
  getOrCreateWeeklyReviewMock.mockResolvedValue(REVIEW);
  dbMock.updateReturning.mockResolvedValue([{ id: "item-1" }]);
});

afterEach(() => {
  dbMock.selectQueue.length = 0;
  vi.clearAllMocks();
});

describe("addItem", () => {
  it("verifies the session before writing", async () => {
    await addItem("2026-07-08", "Ship the thing");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated call before touching the database", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(addItem("2026-07-08", "Ship the thing")).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects a blank title without writing", async () => {
    const result = await addItem("2026-07-08", "   ");
    expect(result.error).toBeTruthy();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects an invalid date without writing", async () => {
    const result = await addItem("not-a-date", "Ship the thing");
    expect(result.error).toBe("That date isn't valid.");
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("creates the day's log lazily and inserts a planned item", async () => {
    const result = await addItem("2026-07-08", "Ship the thing");
    expect(result).toEqual({});
    expect(getOrCreateLogMock).toHaveBeenCalledWith("2026-07-08");
    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        logId: "log-1",
        title: "Ship the thing",
        status: "planned",
        completedAt: null,
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/journal");
    expect(revalidatePath).toHaveBeenCalledWith("/journal/standup");
  });

  it("stamps completedAt when adding an ad-hoc done item", async () => {
    await addItem("2026-07-08", "Did a thing", "done");
    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done", completedAt: expect.any(Date) })
    );
  });
});

describe("editItemTitle", () => {
  it("rejects a blank title without writing", async () => {
    const result = await editItemTitle("item-1", "  ");
    expect(result.error).toBeTruthy();
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("updates the title and revalidates", async () => {
    const result = await editItemTitle("item-1", "Renamed");
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({ title: "Renamed" });
    expect(revalidatePath).toHaveBeenCalledWith("/journal");
  });

  it("returns an error (not a throw) when the item no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await editItemTitle("item-1", "Renamed");
    expect(result.error).toBe("That item no longer exists.");
  });
});

describe("toggleItem", () => {
  it("marks an item done and stamps completedAt", async () => {
    const result = await toggleItem("item-1", true);
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done", completedAt: expect.any(Date) })
    );
  });

  it("unchecking reverses completedAt", async () => {
    await toggleItem("item-1", false);
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      status: "planned",
      completedAt: null,
    });
  });

  it("returns an error when the item no longer exists", async () => {
    dbMock.updateReturning.mockResolvedValueOnce([]);
    const result = await toggleItem("item-1", true);
    expect(result.error).toBe("That item no longer exists.");
  });
});

describe("deleteItem", () => {
  it("verifies the session, deletes, and revalidates", async () => {
    await deleteItem("item-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/journal");
  });
});

describe("rolloverItem", () => {
  it("returns an error when the item no longer exists", async () => {
    dbMock.selectQueue.push([]);
    const result = await rolloverItem("item-1", "2026-07-08");
    expect(result.error).toBe("That item no longer exists.");
  });

  it("rejects rolling over an item that isn't planned", async () => {
    dbMock.selectQueue.push([{ id: "item-1", status: "done", title: "x" }]);
    const result = await rolloverItem("item-1", "2026-07-08");
    expect(result.error).toBe("Only planned items can be rolled over.");
    expect(dbMock.batch).not.toHaveBeenCalled();
  });

  it("copies the item onto tomorrow's log and marks the source rolled_over, in one batch", async () => {
    dbMock.selectQueue.push([
      { id: "item-1", status: "planned", title: "Finish the draft" },
    ]);

    const result = await rolloverItem("item-1", "2026-07-08");

    expect(result).toEqual({});
    expect(getOrCreateLogMock).toHaveBeenCalledWith("2026-07-09");
    expect(dbMock.batch).toHaveBeenCalledTimes(1);
    const [queries] = dbMock.batch.mock.calls[0];
    expect(queries).toHaveLength(2);
    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Finish the draft",
        status: "planned",
        logId: "log-1",
      })
    );
    expect(dbMock.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rolled_over" })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/journal");
  });
});

describe("rolloverAllUnfinished", () => {
  it("is a no-op when the day has no log yet", async () => {
    getDayLogMock.mockResolvedValue({ log: null, items: [] });
    const result = await rolloverAllUnfinished("2026-07-08");
    expect(result).toEqual({});
    expect(dbMock.batch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("is a no-op when there are no planned items", async () => {
    getDayLogMock.mockResolvedValue({
      log: LOG,
      items: [{ id: "i-1", status: "done", title: "x" }],
    });
    const result = await rolloverAllUnfinished("2026-07-08");
    expect(result).toEqual({});
    expect(dbMock.batch).not.toHaveBeenCalled();
  });

  it("rolls over every still-planned item", async () => {
    getDayLogMock.mockResolvedValue({
      log: LOG,
      items: [
        { id: "i-1", status: "planned", title: "One" },
        { id: "i-2", status: "done", title: "Two" },
        { id: "i-3", status: "planned", title: "Three" },
      ],
    });

    const result = await rolloverAllUnfinished("2026-07-08");

    expect(result).toEqual({});
    expect(dbMock.batch).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith("/journal");
  });
});

describe("saveRetro", () => {
  it("saves retro text and revalidates", async () => {
    const result = await saveRetro("2026-07-08", "Great day");
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({ retro: "Great day" });
    expect(revalidatePath).toHaveBeenCalledWith("/journal");
  });

  it("clears retro with an empty string", async () => {
    await saveRetro("2026-07-08", "   ");
    expect(dbMock.updateSet).toHaveBeenCalledWith({ retro: null });
  });

  it("rejects an invalid date", async () => {
    const result = await saveRetro("nope", "Great day");
    expect(result.error).toBeTruthy();
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("saveMood", () => {
  it("saves a valid mood and revalidates", async () => {
    const result = await saveMood("2026-07-08", 4);
    expect(result).toEqual({});
    expect(dbMock.updateSet).toHaveBeenCalledWith({ mood: 4 });
  });

  it("clears mood with null", async () => {
    await saveMood("2026-07-08", null);
    expect(dbMock.updateSet).toHaveBeenCalledWith({ mood: null });
  });

  it("rejects a mood outside 1-5", async () => {
    const result = await saveMood("2026-07-08", 9);
    expect(result.error).toBeTruthy();
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("saveHighlights", () => {
  it("verifies the session, saves highlights, and revalidates the week route", async () => {
    const result = await saveHighlights("2026-07-06", "Shipped the release");
    expect(result).toEqual({});
    expect(verifySession).toHaveBeenCalledTimes(1);
    expect(getOrCreateWeeklyReviewMock).toHaveBeenCalledWith("2026-07-06");
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      highlights: "Shipped the release",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/journal/week");
  });

  it("normalizes a non-Monday weekStart to its Monday before saving", async () => {
    await saveHighlights("2026-07-08", "Great week");
    expect(getOrCreateWeeklyReviewMock).toHaveBeenCalledWith("2026-07-06");
  });

  it("clears highlights with an empty string", async () => {
    await saveHighlights("2026-07-06", "   ");
    expect(dbMock.updateSet).toHaveBeenCalledWith({ highlights: null });
  });

  it("rejects an invalid week", async () => {
    const result = await saveHighlights("nope", "Great week");
    expect(result.error).toBeTruthy();
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(getOrCreateWeeklyReviewMock).not.toHaveBeenCalled();
  });

  it("rejects highlights over the length cap without writing", async () => {
    const result = await saveHighlights("2026-07-06", "x".repeat(4001));
    expect(result.error).toBeTruthy();
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("saveWeeklyRating", () => {
  it("verifies the session, saves a valid rating, and revalidates", async () => {
    const result = await saveWeeklyRating("2026-07-06", 4);
    expect(result).toEqual({});
    expect(verifySession).toHaveBeenCalledTimes(1);
    expect(getOrCreateWeeklyReviewMock).toHaveBeenCalledWith("2026-07-06");
    expect(dbMock.updateSet).toHaveBeenCalledWith({ rating: 4 });
    expect(revalidatePath).toHaveBeenCalledWith("/journal/week");
    expect(revalidatePath).toHaveBeenCalledWith("/journal/week/trend");
  });

  it("clears the rating with null", async () => {
    await saveWeeklyRating("2026-07-06", null);
    expect(dbMock.updateSet).toHaveBeenCalledWith({ rating: null });
  });

  it("normalizes a non-Monday weekStart to its Monday before saving", async () => {
    await saveWeeklyRating("2026-07-08", 3);
    expect(getOrCreateWeeklyReviewMock).toHaveBeenCalledWith("2026-07-06");
  });

  it("rejects a rating outside 1-5 without writing", async () => {
    const result = await saveWeeklyRating("2026-07-06", 9);
    expect(result.error).toBeTruthy();
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(getOrCreateWeeklyReviewMock).not.toHaveBeenCalled();
  });
});

describe("saveAssessmentNote", () => {
  it("verifies the session, saves the given prompt field, and revalidates", async () => {
    const result = await saveAssessmentNote(
      "2026-07-06",
      "wentWell",
      "Shipped the release"
    );
    expect(result).toEqual({});
    expect(verifySession).toHaveBeenCalledTimes(1);
    expect(getOrCreateWeeklyReviewMock).toHaveBeenCalledWith("2026-07-06");
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      wentWell: "Shipped the release",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/journal/week");
  });

  it("saves each of the three prompt fields under their own column", async () => {
    await saveAssessmentNote("2026-07-06", "drainedMe", "Too many meetings");
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      drainedMe: "Too many meetings",
    });

    await saveAssessmentNote("2026-07-06", "changeNext", "Fewer meetings");
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      changeNext: "Fewer meetings",
    });
  });

  it("clears a note with an empty string", async () => {
    await saveAssessmentNote("2026-07-06", "wentWell", "   ");
    expect(dbMock.updateSet).toHaveBeenCalledWith({ wentWell: null });
  });

  it("rejects an invalid week without writing", async () => {
    const result = await saveAssessmentNote("nope", "wentWell", "text");
    expect(result.error).toBeTruthy();
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(getOrCreateWeeklyReviewMock).not.toHaveBeenCalled();
  });

  it("rejects a note over the length cap without writing", async () => {
    const result = await saveAssessmentNote(
      "2026-07-06",
      "drainedMe",
      "x".repeat(2001)
    );
    expect(result.error).toBeTruthy();
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});
