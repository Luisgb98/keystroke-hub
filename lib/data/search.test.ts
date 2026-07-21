// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  buildIdeaSearchCondition,
  buildImprovementSearchCondition,
  buildMeetingNoteSearchCondition,
  buildProjectSearchCondition,
  buildScriptSearchCondition,
  escapeLikePattern,
  mapDailyLogMatchToResult,
  mapIdeaToResult,
  mapImprovementToResult,
  mapMeetingNoteToResult,
  mapProjectToResult,
  mapScriptToResult,
  mergeDailyLogMatches,
  mergeRecentCandidates,
  truncateSnippet,
  type DailyLogMatchRow,
} from "./search";

const dialect = new PgDialect();

function render(condition: ReturnType<typeof buildIdeaSearchCondition>) {
  return dialect.sqlToQuery(condition);
}

describe("truncateSnippet", () => {
  it("returns undefined for null/undefined/blank input", () => {
    expect(truncateSnippet(null)).toBeUndefined();
    expect(truncateSnippet(undefined)).toBeUndefined();
    expect(truncateSnippet("   ")).toBeUndefined();
  });

  it("returns the trimmed value unchanged when short enough", () => {
    expect(truncateSnippet("  hello world  ")).toBe("hello world");
  });

  it("truncates long values with an ellipsis", () => {
    const long = "a".repeat(200);
    const result = truncateSnippet(long);
    expect(result?.endsWith("…")).toBe(true);
    expect(result?.length).toBe(141);
  });
});

describe("escapeLikePattern", () => {
  it("leaves a plain query untouched", () => {
    expect(escapeLikePattern("speedrun")).toBe("speedrun");
  });

  it("escapes ILIKE wildcards so they match literally", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });

  it("escapes a trailing backslash so it never dangles the escape char", () => {
    // Unescaped, `%C:\%` ends with an escape char and errors the whole query.
    expect(escapeLikePattern("C:\\")).toBe("C:\\\\");
  });
});

describe("buildIdeaSearchCondition", () => {
  it("matches title or notes case-insensitively", () => {
    const { sql, params } = render(buildIdeaSearchCondition("speedrun"));
    expect(sql).toContain("ilike");
    expect(sql).toContain('"title"');
    expect(sql).toContain('"notes"');
    expect(sql).toContain(" or ");
    expect(params).toEqual(["%speedrun%", "%speedrun%"]);
  });

  it("escapes wildcard metacharacters in the query (issue #67)", () => {
    const { params } = render(buildIdeaSearchCondition("100%"));
    expect(params).toEqual(["%100\\%%", "%100\\%%"]);
  });
});

describe("buildScriptSearchCondition", () => {
  it("matches script content", () => {
    const { sql, params } = render(buildScriptSearchCondition("cold open"));
    expect(sql).toContain("ilike");
    expect(sql).toContain('"content"');
    expect(params).toEqual(["%cold open%"]);
  });
});

describe("buildMeetingNoteSearchCondition", () => {
  it("matches title, notes, or reflection", () => {
    const { sql, params } = render(buildMeetingNoteSearchCondition("roadmap"));
    expect(sql).toContain('"title"');
    expect(sql).toContain('"notes"');
    expect(sql).toContain('"reflection"');
    expect(params).toEqual(["%roadmap%", "%roadmap%", "%roadmap%"]);
  });
});

describe("buildProjectSearchCondition", () => {
  it("matches name, description, or notes", () => {
    const { sql, params } = render(buildProjectSearchCondition("keystroke"));
    expect(sql).toContain('"name"');
    expect(sql).toContain('"description"');
    expect(sql).toContain('"notes"');
    expect(params).toEqual(["%keystroke%", "%keystroke%", "%keystroke%"]);
  });
});

describe("buildImprovementSearchCondition", () => {
  it("matches title, rationale, or outcome", () => {
    const { sql, params } = render(buildImprovementSearchCondition("ci"));
    expect(sql).toContain('"title"');
    expect(sql).toContain('"rationale"');
    expect(sql).toContain('"outcome"');
    expect(params).toEqual(["%ci%", "%ci%", "%ci%"]);
  });
});

describe("mapIdeaToResult", () => {
  it("maps an idea row to a content-world result", () => {
    const updatedAt = new Date("2026-07-01T00:00:00Z");
    const result = mapIdeaToResult({
      id: "idea-1",
      title: "Speedrun commentary",
      notes: "Cover the wrong warp",
      updatedAt,
    });
    expect(result).toEqual({
      id: "idea-1",
      type: "idea",
      world: "content",
      title: "Speedrun commentary",
      snippet: "Cover the wrong warp",
      href: "/content/ideas/idea-1/script",
      updatedAt,
    });
  });

  it("omits the snippet when notes are null", () => {
    const result = mapIdeaToResult({
      id: "idea-2",
      title: "Untitled",
      notes: null,
      updatedAt: new Date(),
    });
    expect(result.snippet).toBeUndefined();
  });
});

describe("mapScriptToResult", () => {
  it("links to the parent idea and keeps the idea's title", () => {
    const updatedAt = new Date("2026-07-02T00:00:00Z");
    const result = mapScriptToResult({
      ideaId: "idea-1",
      ideaTitle: "Speedrun commentary",
      content: "# Cold open\n\nHook the viewer.",
      updatedAt,
    });
    expect(result.type).toBe("script");
    expect(result.world).toBe("content");
    expect(result.title).toBe("Speedrun commentary");
    expect(result.href).toBe("/content/ideas/idea-1/script");
    expect(result.snippet).toContain("Cold open");
  });
});

describe("mapDailyLogMatchToResult", () => {
  it("formats a short day label into the title and links via ?date=", () => {
    const updatedAt = new Date("2026-07-08T00:00:00Z");
    const result = mapDailyLogMatchToResult({
      logDate: "2026-07-08",
      updatedAt,
      snippet: "Shipped the dashboard",
    });
    expect(result.type).toBe("daily-log");
    expect(result.world).toBe("work");
    expect(result.title).toBe("Daily log — Jul 8");
    expect(result.href).toBe("/journal?date=2026-07-08");
    expect(result.snippet).toBe("Shipped the dashboard");
  });
});

describe("mapMeetingNoteToResult", () => {
  it("maps a meeting note row to a work-world result", () => {
    const updatedAt = new Date("2026-07-03T00:00:00Z");
    const result = mapMeetingNoteToResult({
      id: "meeting-1",
      title: "Weekly sync",
      notes: "Discussed the roadmap",
      updatedAt,
    });
    expect(result.type).toBe("meeting-note");
    expect(result.world).toBe("work");
    expect(result.href).toBe("/projects/meetings/meeting-1");
  });
});

describe("mapProjectToResult", () => {
  it("maps a project row to a work-world result", () => {
    const updatedAt = new Date("2026-07-04T00:00:00Z");
    const result = mapProjectToResult({
      id: "project-1",
      name: "Keystroke Hub",
      description: "The app itself",
      updatedAt,
    });
    expect(result.type).toBe("project");
    expect(result.world).toBe("work");
    expect(result.href).toBe("/projects/project-1");
  });
});

describe("mapImprovementToResult", () => {
  it("links every improvement to the backlog list", () => {
    const updatedAt = new Date("2026-07-05T00:00:00Z");
    const result = mapImprovementToResult({
      id: "improvement-1",
      title: "Automate the release checklist",
      rationale: "Manual steps get skipped",
      updatedAt,
    });
    expect(result.type).toBe("improvement");
    expect(result.world).toBe("work");
    expect(result.href).toBe("/projects/improvements");
  });
});

describe("mergeDailyLogMatches", () => {
  it("dedupes by logDate, keeping the most-recently-updated candidate", () => {
    const older: DailyLogMatchRow = {
      logDate: "2026-07-08",
      updatedAt: new Date("2026-07-08T09:00:00Z"),
      snippet: "retro text",
    };
    const newer: DailyLogMatchRow = {
      logDate: "2026-07-08",
      updatedAt: new Date("2026-07-08T18:00:00Z"),
      snippet: "item title match",
    };
    const otherDay: DailyLogMatchRow = {
      logDate: "2026-07-07",
      updatedAt: new Date("2026-07-07T09:00:00Z"),
      snippet: "yesterday",
    };

    const result = mergeDailyLogMatches([older, newer, otherDay], 5);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(newer);
    expect(result[1]).toEqual(otherDay);
  });

  it("caps to the given limit", () => {
    const rows: DailyLogMatchRow[] = Array.from({ length: 10 }, (_, i) => ({
      logDate: `2026-07-${String(i + 1).padStart(2, "0")}`,
      updatedAt: new Date(2026, 6, i + 1),
      snippet: "x",
    }));
    expect(mergeDailyLogMatches(rows, 3)).toHaveLength(3);
  });
});

describe("mergeRecentCandidates", () => {
  it("sorts newest-updated-first across entities and caps the total", () => {
    const a = mapIdeaToResult({
      id: "a",
      title: "A",
      notes: null,
      updatedAt: new Date("2026-07-01T00:00:00Z"),
    });
    const b = mapProjectToResult({
      id: "b",
      name: "B",
      description: null,
      updatedAt: new Date("2026-07-03T00:00:00Z"),
    });
    const c = mapImprovementToResult({
      id: "c",
      title: "C",
      rationale: null,
      updatedAt: new Date("2026-07-02T00:00:00Z"),
    });

    const result = mergeRecentCandidates([a, b, c], 2);
    expect(result.map((r) => r.id)).toEqual(["b", "c"]);
  });
});
