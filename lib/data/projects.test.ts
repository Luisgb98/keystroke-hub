// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  aggregateLinkedIdeaCounts,
  sortProjectSummaries,
  splitArchivedProjects,
} from "./projects";
import type { ProjectSummary } from "./projects";

describe("aggregateLinkedIdeaCounts", () => {
  it("returns an empty map for no rows", () => {
    expect(aggregateLinkedIdeaCounts([]).size).toBe(0);
  });

  it("counts ideas per project, ignoring unassigned ones", () => {
    const result = aggregateLinkedIdeaCounts([
      { projectId: "p-1" },
      { projectId: "p-1" },
      { projectId: "p-2" },
      { projectId: null },
    ]);
    expect(result.get("p-1")).toBe(2);
    expect(result.get("p-2")).toBe(1);
    expect(result.has(null as unknown as string)).toBe(false);
  });
});

function summary(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: "p-1",
    name: "Project",
    description: null,
    status: "active",
    archivedAt: null,
    linkedIdeaCount: 0,
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("sortProjectSummaries", () => {
  it("orders active before paused before done", () => {
    const done = summary({ id: "done", status: "done" });
    const active = summary({ id: "active", status: "active" });
    const paused = summary({ id: "paused", status: "paused" });
    const result = sortProjectSummaries([done, active, paused]);
    expect(result.map((p) => p.id)).toEqual(["active", "paused", "done"]);
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
    const result = sortProjectSummaries([older, newer]);
    expect(result.map((p) => p.id)).toEqual(["newer", "older"]);
  });

  it("does not mutate the input array", () => {
    const input = [summary({ id: "a" }), summary({ id: "b" })];
    const copy = [...input];
    sortProjectSummaries(input);
    expect(input).toEqual(copy);
  });
});

describe("splitArchivedProjects", () => {
  it("separates archived from active and sorts each group", () => {
    const activeProject = summary({ id: "active", archivedAt: null });
    const archivedProject = summary({
      id: "archived",
      archivedAt: new Date("2026-02-01T00:00:00Z"),
    });
    const result = splitArchivedProjects([archivedProject, activeProject]);
    expect(result.active.map((p) => p.id)).toEqual(["active"]);
    expect(result.archived.map((p) => p.id)).toEqual(["archived"]);
  });
});

// --- DB-backed query tests (mocked, per `lib/data/streams.test.ts`) ---

const dbMock = vi.hoisted(() => {
  const queue: unknown[][] = [];
  function next(): Promise<unknown[]> {
    return Promise.resolve(queue.shift() ?? []);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeChain(): any {
    const chain = {
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
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
  getProject,
  getProjectSummariesForIdeas,
  listProjects,
  searchLinkableIdeas,
} from "./projects";

afterEach(() => {
  dbMock.queue.length = 0;
  vi.clearAllMocks();
});

describe("listProjects", () => {
  it("attaches a linked-idea count to each project and splits archived", async () => {
    dbMock.queue.push([
      {
        id: "p-1",
        name: "Active project",
        description: null,
        status: "active",
        archivedAt: null,
        notes: "",
        createdAt: new Date(),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
    dbMock.queue.push([{ projectId: "p-1" }, { projectId: "p-1" }]);

    const result = await listProjects();

    expect(result.active).toHaveLength(1);
    expect(result.active[0]).toMatchObject({ id: "p-1", linkedIdeaCount: 2 });
    expect(result.archived).toEqual([]);
  });
});

describe("getProject", () => {
  it("returns null when the project doesn't exist", async () => {
    dbMock.queue.push([]);
    const result = await getProject("missing");
    expect(result).toBeNull();
  });

  it("returns the project and its linked ideas", async () => {
    dbMock.queue.push([
      {
        id: "p-1",
        name: "Project",
        description: null,
        status: "active",
        archivedAt: null,
        notes: "",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    dbMock.queue.push([
      { id: "i-1", title: "Idea", format: "video", status: "spark" },
    ]);

    const result = await getProject("p-1");
    expect(result?.project.id).toBe("p-1");
    expect(result?.linkedIdeas).toEqual([
      { id: "i-1", title: "Idea", format: "video", status: "spark" },
    ]);
  });
});

describe("searchLinkableIdeas", () => {
  it("returns whatever the query resolves to", async () => {
    dbMock.queue.push([{ id: "i-1", title: "Unassigned idea" }]);
    const result = await searchLinkableIdeas("");
    expect(result).toEqual([{ id: "i-1", title: "Unassigned idea" }]);
  });
});

describe("getProjectSummariesForIdeas", () => {
  it("returns an empty map without querying for no ideas", async () => {
    const result = await getProjectSummariesForIdeas([]);
    expect(result.size).toBe(0);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("maps each idea id to its project summary", async () => {
    dbMock.queue.push([
      { ideaId: "i-1", projectId: "p-1", projectName: "Project" },
    ]);
    const result = await getProjectSummariesForIdeas(["i-1"]);
    expect(result.get("i-1")).toEqual({ id: "p-1", name: "Project" });
  });
});
