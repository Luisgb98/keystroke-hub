// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => {
  const queue: unknown[][] = [];
  function next(): Promise<unknown[]> {
    return Promise.resolve(queue.shift() ?? []);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function makeChain(): any {
    const chain = {
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
  listGithubIssueLinksForImprovements,
  listGithubIssueLinksForMeetingNote,
  listGithubIssueLinksForProject,
} from "./github-links";

afterEach(() => {
  dbMock.queue.length = 0;
  vi.clearAllMocks();
});

const row = {
  id: "link-1",
  owner: "Luisgb98",
  repo: "keystroke-hub",
  issueNumber: 27,
  title: "GitHub Issue linking",
  state: "open" as const,
  fetchedAt: new Date("2026-07-12T00:00:00Z"),
};

describe("listGithubIssueLinksForProject", () => {
  it("maps rows and derives the GitHub URL", async () => {
    dbMock.queue.push([row]);
    const result = await listGithubIssueLinksForProject("project-1");
    expect(result).toEqual([
      { ...row, url: "https://github.com/Luisgb98/keystroke-hub/issues/27" },
    ]);
  });
});

describe("listGithubIssueLinksForMeetingNote", () => {
  it("maps rows and derives the GitHub URL", async () => {
    dbMock.queue.push([row]);
    const result = await listGithubIssueLinksForMeetingNote("meeting-1");
    expect(result).toEqual([
      { ...row, url: "https://github.com/Luisgb98/keystroke-hub/issues/27" },
    ]);
  });
});

describe("listGithubIssueLinksForImprovements", () => {
  it("returns an empty map without querying for an empty id list", async () => {
    const result = await listGithubIssueLinksForImprovements([]);
    expect(result.size).toBe(0);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("groups links by improvement id, preserving query order", async () => {
    dbMock.queue.push([
      { ...row, id: "link-1", improvementId: "improvement-1" },
      {
        ...row,
        id: "link-2",
        issueNumber: 28,
        improvementId: "improvement-1",
      },
      { ...row, id: "link-3", improvementId: "improvement-2" },
    ]);

    const result = await listGithubIssueLinksForImprovements([
      "improvement-1",
      "improvement-2",
    ]);

    expect(result.get("improvement-1")?.map((link) => link.id)).toEqual([
      "link-1",
      "link-2",
    ]);
    expect(result.get("improvement-2")?.map((link) => link.id)).toEqual([
      "link-3",
    ]);
  });
});
