// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { DailyLogItem } from "@/lib/db/schema";

import { buildStandupView } from "./standup";

let idCounter = 0;

function item(overrides: Partial<DailyLogItem> = {}): DailyLogItem {
  idCounter += 1;
  return {
    id: `item-${idCounter}`,
    logId: "log-1",
    title: "Do the thing",
    status: "planned",
    rolledOverToId: null,
    position: 0,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("buildStandupView", () => {
  it("shows only done items for yesterday and excludes rolled-over items from today", () => {
    const done = item({ title: "Shipped the thing", status: "done" });
    const stillPlanned = item({ title: "Half-finished", status: "planned" });
    const rolled = item({ title: "Rolled away", status: "rolled_over" });

    const view = buildStandupView(
      { date: "2026-07-08", items: [stillPlanned, rolled] },
      { date: "2026-07-07", items: [done, rolled] }
    );

    expect(view.yesterday).toEqual({
      date: "2026-07-07",
      items: [{ id: done.id, title: "Shipped the thing", status: "done" }],
      isEmpty: false,
    });
    expect(view.today).toEqual({
      date: "2026-07-08",
      items: [
        { id: stillPlanned.id, title: "Half-finished", status: "planned" },
      ],
      isEmpty: false,
    });
  });

  it("marks yesterday empty when the most recent past log has no done items", () => {
    const view = buildStandupView(
      { date: "2026-07-08", items: [] },
      { date: "2026-07-07", items: [item({ status: "planned" })] }
    );

    expect(view.yesterday).toEqual({
      date: "2026-07-07",
      items: [],
      isEmpty: true,
    });
  });

  it("returns null yesterday when no day before today has ever been logged", () => {
    const view = buildStandupView({ date: "2026-07-08", items: [] }, null);
    expect(view.yesterday).toBeNull();
  });

  it("reaches across a gap day (e.g. Monday standup looks past an empty Sunday) when the caller supplies the most recent logged day", () => {
    // The gap-day skip itself happens in the data layer's query (most
    // recent logged date < today); this only asserts that whatever day is
    // passed in is what gets shown, labeled with its own date.
    const done = item({ title: "Friday wrap-up", status: "done" });
    const view = buildStandupView(
      { date: "2026-07-13", items: [] }, // Monday
      { date: "2026-07-10", items: [done] } // Friday
    );

    expect(view.yesterday?.date).toBe("2026-07-10");
    expect(view.yesterday?.items).toEqual([
      { id: done.id, title: "Friday wrap-up", status: "done" },
    ]);
  });

  it("marks today empty when there is no plan yet", () => {
    const view = buildStandupView({ date: "2026-07-08", items: [] }, null);
    expect(view.today.isEmpty).toBe(true);
  });
});
