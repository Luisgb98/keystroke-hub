import { describe, expect, it } from "vitest";

import type { DayLog } from "@/lib/data/daily-logs";
import type { DailyLog, DailyLogItem } from "@/lib/db/schema";

import { buildLogSummary } from "./log-summary";

const NOW = new Date("2026-07-12T12:00:00Z");

function makeLog(overrides: Partial<DailyLog> = {}): DailyLog {
  return {
    id: "log-1",
    logDate: "2026-07-12",
    retro: null,
    mood: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeItem(overrides: Partial<DailyLogItem> = {}): DailyLogItem {
  return {
    id: `item-${Math.random()}`,
    logId: "log-1",
    title: "Do a thing",
    status: "planned",
    rolledOverToId: null,
    position: 0,
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("buildLogSummary", () => {
  it("reports not_started when no log row exists yet", () => {
    const summary = buildLogSummary({ log: null, items: [] });
    expect(summary.state).toBe("not_started");
    expect(summary.plannedCount).toBe(0);
    expect(summary.doneCount).toBe(0);
    expect(summary.hasRetro).toBe(false);
    expect(summary.moodLabel).toBeNull();
    expect(summary.ctaLabel).toBe("Start today's log");
    expect(summary.ctaHref).toBe("/journal");
  });

  it("reports not_started when the log row exists but is still empty", () => {
    const dayLog: DayLog = { log: makeLog(), items: [] };
    expect(buildLogSummary(dayLog).state).toBe("not_started");
  });

  it("counts planned-only items as in_progress", () => {
    const dayLog: DayLog = {
      log: makeLog(),
      items: [makeItem({ status: "planned" }), makeItem({ status: "planned" })],
    };
    const summary = buildLogSummary(dayLog);
    expect(summary.state).toBe("in_progress");
    expect(summary.plannedCount).toBe(2);
    expect(summary.doneCount).toBe(0);
    expect(summary.ctaLabel).toBe("Continue today's log");
  });

  it("counts a mix of planned and done items separately", () => {
    const dayLog: DayLog = {
      log: makeLog(),
      items: [
        makeItem({ status: "planned" }),
        makeItem({ status: "done" }),
        makeItem({ status: "done" }),
      ],
    };
    const summary = buildLogSummary(dayLog);
    expect(summary.plannedCount).toBe(1);
    expect(summary.doneCount).toBe(2);
  });

  it("excludes rolled_over items from both counts", () => {
    const dayLog: DayLog = {
      log: makeLog(),
      items: [
        makeItem({ status: "rolled_over" }),
        makeItem({ status: "planned" }),
      ],
    };
    const summary = buildLogSummary(dayLog);
    expect(summary.plannedCount).toBe(1);
    expect(summary.doneCount).toBe(0);
  });

  it("treats a retro-only day as started, with retro and mood surfaced", () => {
    const dayLog: DayLog = {
      log: makeLog({ retro: "Shipped the thing.", mood: 4 }),
      items: [],
    };
    const summary = buildLogSummary(dayLog);
    expect(summary.state).toBe("in_progress");
    expect(summary.hasRetro).toBe(true);
    expect(summary.moodLabel).toBe("Good");
  });
});
