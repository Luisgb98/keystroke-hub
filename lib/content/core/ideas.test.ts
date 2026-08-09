// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
  // Same awaitable chain shape as lib/content/actions.test.ts.
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

vi.mock("@/lib/db", () => ({ getDb: () => dbMock }));

import { revalidatePath } from "next/cache";

import {
  pushEventCreated,
  pushEventDeleted,
  pushEventUpdated,
} from "@/lib/sync/push";

import { clearIdeaReleaseCore, setIdeaReleaseCore } from "./ideas";

/**
 * The two release mutations that exist only for the MCP surface (#109) — the
 * UI reaches the same outcomes through the edit dialog and the release chip.
 * Everything else in this module is exercised through `lib/content/actions.test.ts`.
 */

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.selectQueue.length = 0;
  dbMock.insertReturning.mockResolvedValue([{ id: "evt-new" }]);
  dbMock.updateReturning.mockResolvedValue([{ id: "evt-1", track: "content" }]);
  dbMock.deleteReturning.mockResolvedValue([{ id: "evt-1", track: "content" }]);
});

describe("setIdeaReleaseCore", () => {
  it("creates the managed event when the idea has no release yet", async () => {
    dbMock.selectQueue.push([{ title: "Speedrun any%", releaseEventId: null }]);

    const result = await setIdeaReleaseCore("idea-1", "2026-08-01", "19:00");

    expect(result).toEqual({});
    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        track: "content",
        title: "Release: Speedrun any%",
        allDay: false,
        // 19:00 in the app zone, not the server's UTC (issue #95).
        startsAt: new Date("2026-08-01T17:00:00.000Z"),
        endsAt: new Date("2026-08-01T18:00:00.000Z"),
      })
    );
    expect(pushEventCreated).toHaveBeenCalledWith("evt-new", "content");
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  // The domain owns the 19:00 default so both doors can't drift apart.
  it("defaults a date without a time to 19:00", async () => {
    dbMock.selectQueue.push([{ title: "Speedrun any%", releaseEventId: null }]);
    await setIdeaReleaseCore("idea-1", "2026-08-01");
    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        startsAt: new Date("2026-08-01T17:00:00.000Z"),
      })
    );
  });

  it("moves the existing event when the idea already has a release", async () => {
    dbMock.selectQueue.push([
      { title: "Speedrun any%", releaseEventId: "evt-1" },
    ]);

    await setIdeaReleaseCore("idea-1", "2026-08-07", "20:30");

    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(dbMock.updateSet).toHaveBeenCalledWith({
      title: "Release: Speedrun any%",
      startsAt: new Date("2026-08-07T18:30:00.000Z"),
      endsAt: new Date("2026-08-07T19:30:00.000Z"),
    });
    expect(pushEventUpdated).toHaveBeenCalledWith("evt-1", "content");
  });

  it("rejects a well-formed but nonexistent day without writing", async () => {
    const result = await setIdeaReleaseCore("idea-1", "2026-02-30", "19:00");
    expect(result).toEqual({ error: "Pick a real day and time." });
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("rejects a malformed time without writing", async () => {
    const result = await setIdeaReleaseCore("idea-1", "2026-08-01", "25:00");
    expect(result).toEqual({ error: "Pick a real day and time." });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("fails on an idea that no longer exists", async () => {
    dbMock.selectQueue.push([]);
    const result = await setIdeaReleaseCore("gone", "2026-08-01", "19:00");
    expect(result).toEqual({ error: "That idea no longer exists." });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe("clearIdeaReleaseCore", () => {
  it("deletes the managed event and pushes the Google-side delete", async () => {
    dbMock.selectQueue.push([{ releaseEventId: "evt-1" }]); // the idea
    dbMock.selectQueue.push([{ id: "link-1", googleEventId: "g-1" }]); // sync link

    const result = await clearIdeaReleaseCore("idea-1");

    expect(result).toEqual({});
    expect(dbMock.delete).toHaveBeenCalled();
    expect(pushEventDeleted).toHaveBeenCalledWith("link-1", "g-1", "content");
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("is an idempotent no-op on an already-unscheduled idea", async () => {
    dbMock.selectQueue.push([{ releaseEventId: null }]);
    const result = await clearIdeaReleaseCore("idea-1");
    expect(result).toEqual({});
    expect(dbMock.delete).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("fails on an idea that no longer exists", async () => {
    dbMock.selectQueue.push([]);
    const result = await clearIdeaReleaseCore("gone");
    expect(result).toEqual({ error: "That idea no longer exists." });
    expect(dbMock.delete).not.toHaveBeenCalled();
  });
});
