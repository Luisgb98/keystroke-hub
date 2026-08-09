import { describe, expect, it } from "vitest";

import {
  buildDelta,
  currentMonthParam,
  formatDeltaLabel,
  formatGameAttentionDetail,
  formatMonthLabel,
  formatMonthShortLabel,
  isCurrentMonthParam,
  isMonthParam,
  mergeGameAttention,
  monthParamOf,
  monthRange,
  parseMonthParam,
  rankItems,
  shiftMonthParam,
  withShare,
  type GameAttention,
} from "./month-review";

// The process runs in UTC (vitest.config.ts) while the app zone is
// Europe/Madrid — the exact split that produced issue #95. Every assertion
// below is against an absolute instant or an app-zone rendering, never
// against a re-parse of the same wall-clock string.

describe("monthParamOf / currentMonthParam", () => {
  it("reads the month in the app zone, not the process zone", () => {
    // 23:30 UTC on July 31 is already 01:30 on August 1 in Madrid.
    expect(monthParamOf(new Date("2026-07-31T23:30:00Z"))).toBe("2026-08");
  });

  it("keeps the previous month for an instant still inside it locally", () => {
    // 00:30 UTC on August 1 is 02:30 August 1 in Madrid — still August.
    expect(monthParamOf(new Date("2026-08-01T00:30:00Z"))).toBe("2026-08");
    // 22:30 UTC on July 31 is 00:30 August 1 in Madrid.
    expect(monthParamOf(new Date("2026-07-31T21:30:00Z"))).toBe("2026-07");
  });

  it("resolves the current month through the same app-zone reading", () => {
    expect(currentMonthParam(new Date("2026-01-31T23:00:00Z"))).toBe("2026-02");
  });
});

describe("isMonthParam", () => {
  it("accepts a well-formed month", () => {
    expect(isMonthParam("2026-08")).toBe(true);
    expect(isMonthParam("2026-01")).toBe(true);
    expect(isMonthParam("2026-12")).toBe(true);
  });

  it("rejects anything that isn't a real yyyy-MM month", () => {
    for (const value of [
      "2026-13",
      "2026-00",
      "2026-8",
      "26-08",
      "2026/08",
      "2026-08-01",
      "not-a-month",
      "",
      undefined,
      null,
      42,
    ]) {
      expect(isMonthParam(value)).toBe(false);
    }
  });
});

describe("parseMonthParam", () => {
  const now = new Date("2026-08-09T10:00:00Z");

  it("defaults to the current month when the param is absent", () => {
    expect(parseMonthParam(undefined, now)).toBe("2026-08");
  });

  it("keeps a valid past month", () => {
    expect(parseMonthParam("2026-03", now)).toBe("2026-03");
    expect(parseMonthParam("2019-11", now)).toBe("2019-11");
  });

  it("falls back to the current month for a malformed value", () => {
    expect(parseMonthParam("2026-13", now)).toBe("2026-08");
    expect(parseMonthParam("nonsense", now)).toBe("2026-08");
  });

  it("never steps forward past the current month", () => {
    expect(parseMonthParam("2026-09", now)).toBe("2026-08");
    expect(parseMonthParam("2099-01", now)).toBe("2026-08");
  });

  it("keeps the current month itself", () => {
    expect(parseMonthParam("2026-08", now)).toBe("2026-08");
  });

  it("ignores a repeated param, which arrives as an array", () => {
    expect(parseMonthParam(["2026-03", "2026-04"], now)).toBe("2026-08");
  });

  it("clamps against the app zone's month, not the process zone's", () => {
    // 23:30 UTC on Aug 31 is already September in Madrid, so September is
    // no longer "the future" and must survive.
    const boundary = new Date("2026-08-31T23:30:00Z");
    expect(parseMonthParam("2026-09", boundary)).toBe("2026-09");
  });
});

describe("monthRange", () => {
  it("spans midnight-to-midnight in the app zone, half-open", () => {
    const range = monthRange("2026-08");
    // Madrid is UTC+2 in August, so the month starts at 22:00 UTC on Jul 31.
    expect(range.start.toISOString()).toBe("2026-07-31T22:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-31T22:00:00.000Z");
  });

  it("straddles the winter offset correctly", () => {
    const range = monthRange("2026-01");
    // Madrid is UTC+1 in January.
    expect(range.start.toISOString()).toBe("2025-12-31T23:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-01-31T23:00:00.000Z");
  });

  it("covers the DST changeover month end to end", () => {
    // October 2026 starts in CEST (+2) and ends in CET (+1).
    const range = monthRange("2026-10");
    expect(range.start.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("throws rather than silently ranging over a bad value", () => {
    expect(() => monthRange("2026-13")).toThrow(/2026-13/);
  });
});

describe("shiftMonthParam", () => {
  it("steps back and forward by whole calendar months", () => {
    expect(shiftMonthParam("2026-08", -1)).toBe("2026-07");
    expect(shiftMonthParam("2026-08", 1)).toBe("2026-09");
  });

  it("crosses the year boundary in both directions", () => {
    expect(shiftMonthParam("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthParam("2025-12", 1)).toBe("2026-01");
  });

  it("steps back from a 31-day month into a 28-day one without overflowing", () => {
    expect(shiftMonthParam("2026-03", -1)).toBe("2026-02");
  });
});

describe("isCurrentMonthParam", () => {
  it("compares against the app zone's month", () => {
    const now = new Date("2026-08-09T10:00:00Z");
    expect(isCurrentMonthParam("2026-08", now)).toBe(true);
    expect(isCurrentMonthParam("2026-07", now)).toBe(false);
  });
});

describe("formatMonthLabel", () => {
  it("renders the month in the app zone", () => {
    expect(formatMonthLabel("2026-08")).toBe("August 2026");
    expect(formatMonthLabel("2025-12")).toBe("December 2025");
  });

  it("has a short form for delta lines", () => {
    expect(formatMonthShortLabel("2026-07")).toBe("Jul");
  });
});

describe("withShare", () => {
  it("sizes each bar against the largest row, keeping the caller's order", () => {
    const rows = withShare([{ count: 1 }, { count: 4 }, { count: 2 }]);
    expect(rows.map((row) => row.count)).toEqual([1, 4, 2]);
    expect(rows.map((row) => row.share)).toEqual([0.25, 1, 0.5]);
  });

  it("gives an all-zero list zero-width bars rather than NaN", () => {
    const rows = withShare([{ count: 0 }, { count: 0 }]);
    expect(rows.every((row) => row.share === 0)).toBe(true);
  });

  it("returns nothing for an empty list", () => {
    expect(withShare([])).toEqual([]);
  });
});

describe("rankItems", () => {
  const items = [
    { label: "Hades", count: 2 },
    { label: "Path of Exile", count: 5 },
    { label: "Balatro", count: 2 },
  ];

  it("orders biggest first and breaks ties by label", () => {
    expect(rankItems(items, 10).map((item) => item.label)).toEqual([
      "Path of Exile",
      "Balatro",
      "Hades",
    ]);
  });

  it("gives the leader a full bar", () => {
    expect(rankItems(items, 10)[0].share).toBe(1);
  });

  it("caps the list at the limit", () => {
    expect(rankItems(items, 2)).toHaveLength(2);
  });

  it("carries extra fields through untouched", () => {
    const [top] = rankItems([{ label: "Hades", count: 1, href: "/x" }], 1);
    expect(top.href).toBe("/x");
  });
});

describe("buildDelta / formatDeltaLabel", () => {
  it("reads an increase", () => {
    const delta = buildDelta(5, 3);
    expect(delta).toEqual({ change: 2, direction: "up" });
    expect(formatDeltaLabel(delta, "2026-07")).toBe("+2 vs Jul");
  });

  it("reads a decrease", () => {
    const delta = buildDelta(1, 4);
    expect(delta).toEqual({ change: -3, direction: "down" });
    expect(formatDeltaLabel(delta, "2026-07")).toBe("-3 vs Jul");
  });

  it("reads no change, including two empty months", () => {
    expect(buildDelta(0, 0)).toEqual({ change: 0, direction: "flat" });
    expect(formatDeltaLabel(buildDelta(0, 0), "2026-07")).toBe("Same as Jul");
  });

  it("reports a first-ever month as a plain gain, never a percentage of zero", () => {
    expect(formatDeltaLabel(buildDelta(3, 0), "2025-12")).toBe("+3 vs Dec");
  });
});

describe("mergeGameAttention", () => {
  it("sums ideas and streams per game", () => {
    const merged = mergeGameAttention(
      [{ gameId: "g1", gameName: "Hades", count: 3 }],
      [{ gameId: "g1", gameName: "Hades", count: 2 }]
    );
    expect(merged).toEqual([
      {
        gameId: "g1",
        name: "Hades",
        ideaCount: 3,
        streamCount: 2,
        total: 5,
      },
    ]);
  });

  it("keeps a game that only has streams, with a zero on the idea side", () => {
    const merged = mergeGameAttention(
      [],
      [{ gameId: "g2", gameName: "Balatro", count: 1 }]
    );
    expect(merged[0]).toMatchObject({
      name: "Balatro",
      ideaCount: 0,
      streamCount: 1,
      total: 1,
    });
  });

  it("buckets untagged ideas and streams together as 'No game' rather than dropping them", () => {
    const merged = mergeGameAttention(
      [{ gameId: null, gameName: null, count: 4 }],
      [{ gameId: null, gameName: null, count: 1 }]
    );
    expect(merged).toEqual([
      {
        gameId: null,
        name: "No game",
        ideaCount: 4,
        streamCount: 1,
        total: 5,
      },
    ]);
  });

  it("ranks by total, with the no-game bucket after named games on a tie", () => {
    const merged = mergeGameAttention(
      [
        { gameId: null, gameName: null, count: 2 },
        { gameId: "g1", gameName: "Hades", count: 2 },
        { gameId: "g2", gameName: "Path of Exile", count: 7 },
      ],
      []
    );
    expect(merged.map((game) => game.name)).toEqual([
      "Path of Exile",
      "Hades",
      "No game",
    ]);
  });

  it("is empty for a month with nothing in it", () => {
    expect(mergeGameAttention([], [])).toEqual([]);
  });
});

describe("formatGameAttentionDetail", () => {
  function game(overrides: Partial<GameAttention>): GameAttention {
    return {
      gameId: "g1",
      name: "Hades",
      ideaCount: 0,
      streamCount: 0,
      total: 0,
      ...overrides,
    };
  }

  it("names both sides when both have something", () => {
    expect(
      formatGameAttentionDetail(game({ ideaCount: 3, streamCount: 1 }))
    ).toBe("3 ideas · 1 stream");
  });

  it("leaves out an empty side rather than printing a zero", () => {
    expect(formatGameAttentionDetail(game({ ideaCount: 2 }))).toBe("2 ideas");
    expect(formatGameAttentionDetail(game({ streamCount: 2 }))).toBe(
      "2 streams"
    );
  });

  it("is empty when there is nothing to say", () => {
    expect(formatGameAttentionDetail(game({}))).toBe("");
  });
});
