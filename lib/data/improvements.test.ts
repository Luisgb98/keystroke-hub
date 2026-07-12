// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  sortImprovementsForAgenda,
  sortImprovementsForAll,
} from "./improvements";
import type { ImprovementSummary } from "./improvements";

function summary(
  overrides: Partial<ImprovementSummary> = {}
): ImprovementSummary {
  return {
    id: "i-1",
    title: "Improvement",
    rationale: null,
    status: "proposed",
    outcome: null,
    projectId: null,
    projectName: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    githubIssueLinks: [],
    ...overrides,
  };
}

describe("sortImprovementsForAgenda", () => {
  it("keeps only proposed items", () => {
    const proposed = summary({ id: "proposed", status: "proposed" });
    const discussed = summary({ id: "discussed", status: "discussed" });
    const done = summary({ id: "done", status: "done" });
    const result = sortImprovementsForAgenda([proposed, discussed, done]);
    expect(result.map((i) => i.id)).toEqual(["proposed"]);
  });

  it("sorts oldest-first so long-waiting items surface", () => {
    const older = summary({
      id: "older",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const newer = summary({
      id: "newer",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });
    const result = sortImprovementsForAgenda([newer, older]);
    expect(result.map((i) => i.id)).toEqual(["older", "newer"]);
  });
});

describe("sortImprovementsForAll", () => {
  it("orders by pipeline stage: proposed, discussed, accepted, done, rejected", () => {
    const rejected = summary({ id: "rejected", status: "rejected" });
    const proposed = summary({ id: "proposed", status: "proposed" });
    const done = summary({ id: "done", status: "done" });
    const accepted = summary({ id: "accepted", status: "accepted" });
    const discussed = summary({ id: "discussed", status: "discussed" });
    const result = sortImprovementsForAll([
      rejected,
      proposed,
      done,
      accepted,
      discussed,
    ]);
    expect(result.map((i) => i.id)).toEqual([
      "proposed",
      "discussed",
      "accepted",
      "done",
      "rejected",
    ]);
  });

  it("breaks ties within a status by most-recently-updated first", () => {
    const older = summary({
      id: "older",
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    const newer = summary({
      id: "newer",
      updatedAt: new Date("2026-06-01T00:00:00Z"),
    });
    const result = sortImprovementsForAll([older, newer]);
    expect(result.map((i) => i.id)).toEqual(["newer", "older"]);
  });

  it("does not mutate the input array", () => {
    const input = [summary({ id: "a" }), summary({ id: "b" })];
    const copy = [...input];
    sortImprovementsForAll(input);
    expect(input).toEqual(copy);
  });
});

// --- DB-backed query tests (mocked, per lib/data/projects.test.ts) ---

const dbMock = vi.hoisted(() => {
  const queue: unknown[][] = [];
  function next(): Promise<unknown[]> {
    return Promise.resolve(queue.shift() ?? []);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeChain(): any {
    const chain = {
      leftJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
        next().then(resolve, reject),
    };
    return chain;
  }
  return {
    queue,
    select: vi.fn(() => ({ from: vi.fn(() => makeChain()) })),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: () => dbMock,
}));

import {
  getImprovementsForProject,
  listImprovements,
  listLinkableProjects,
} from "./improvements";

afterEach(() => {
  dbMock.queue.length = 0;
  vi.clearAllMocks();
});

describe("listImprovements", () => {
  it("splits into agenda (proposed) and all, with project chip data joined in", async () => {
    dbMock.queue.push([
      {
        id: "i-1",
        title: "Proposed one",
        rationale: null,
        status: "proposed",
        outcome: null,
        projectId: "p-1",
        projectName: "Keystroke Hub",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: "i-2",
        title: "Done one",
        rationale: null,
        status: "done",
        outcome: "Shipped",
        projectId: null,
        projectName: null,
        createdAt: new Date("2026-01-02T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);

    const result = await listImprovements();

    expect(result.agenda.map((i) => i.id)).toEqual(["i-1"]);
    expect(result.all.map((i) => i.id)).toEqual(["i-1", "i-2"]);
    expect(result.agenda[0].projectName).toBe("Keystroke Hub");
  });
});

describe("listLinkableProjects", () => {
  it("returns whatever the query resolves to", async () => {
    dbMock.queue.push([{ id: "p-1", name: "Keystroke Hub" }]);
    const result = await listLinkableProjects();
    expect(result).toEqual([{ id: "p-1", name: "Keystroke Hub" }]);
  });
});

describe("getImprovementsForProject", () => {
  it("returns whatever the query resolves to", async () => {
    dbMock.queue.push([
      { id: "i-1", title: "Improvement", status: "proposed" },
    ]);
    const result = await getImprovementsForProject("p-1");
    expect(result).toEqual([
      { id: "i-1", title: "Improvement", status: "proposed" },
    ]);
  });
});
