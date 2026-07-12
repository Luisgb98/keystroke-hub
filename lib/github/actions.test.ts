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

const fetchIssueMetadata = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ fetchIssueMetadata }));

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
  const deleteReturning = vi.fn();

  return {
    selectQueue,
    insertValues,
    updateSet,
    deleteReturning,
    select: vi.fn(() => ({ from: vi.fn(() => makeSelectChain()) })),
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({
      set: vi.fn((values) => {
        updateSet(values);
        return { where: vi.fn(() => Promise.resolve()) };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ returning: deleteReturning })),
    })),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: () => dbMock,
}));

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import {
  attachGithubIssue,
  detachGithubIssue,
  refreshGithubIssueLink,
} from "./actions";

beforeEach(() => {
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  dbMock.deleteReturning.mockResolvedValue([]);
});

afterEach(() => {
  dbMock.selectQueue.length = 0;
  vi.clearAllMocks();
});

describe("attachGithubIssue", () => {
  const target = { type: "project" as const, id: "project-1" };

  it("verifies the session before writing", async () => {
    dbMock.selectQueue.push([{ id: "project-1", archivedAt: null }]);
    dbMock.selectQueue.push([]);
    fetchIssueMetadata.mockResolvedValue({ ok: false, reason: "not_found" });
    await attachGithubIssue(target, "owner/repo#1");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated call before writing", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(attachGithubIssue(target, "owner/repo#1")).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("returns an error for an invalid ref without touching the database", async () => {
    const result = await attachGithubIssue(target, "not a ref");
    expect(result.error).toBeTruthy();
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("returns an error for a blank ref without touching the database", async () => {
    const result = await attachGithubIssue(target, "   ");
    expect(result.error).toBeTruthy();
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("rejects an unknown project without writing", async () => {
    dbMock.selectQueue.push([]);
    const result = await attachGithubIssue(target, "owner/repo#1");
    expect(result.error).toBe("That project no longer exists.");
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects an archived project without writing", async () => {
    dbMock.selectQueue.push([
      { id: "project-1", archivedAt: new Date("2026-01-01T00:00:00Z") },
    ]);
    const result = await attachGithubIssue(target, "owner/repo#1");
    expect(result.error).toBe("Archived projects can't take new links.");
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects an unknown improvement without writing", async () => {
    dbMock.selectQueue.push([]);
    const result = await attachGithubIssue(
      { type: "improvement", id: "improvement-1" },
      "owner/repo#1"
    );
    expect(result.error).toBe("That improvement no longer exists.");
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects an unknown meeting note without writing", async () => {
    dbMock.selectQueue.push([]);
    const result = await attachGithubIssue(
      { type: "meetingNote", id: "meeting-1" },
      "owner/repo#1"
    );
    expect(result.error).toBe("That meeting note no longer exists.");
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("attaches with the canonical owner/repo casing when metadata resolves", async () => {
    dbMock.selectQueue.push([{ id: "project-1", archivedAt: null }]);
    dbMock.selectQueue.push([]); // no existing duplicate
    fetchIssueMetadata.mockResolvedValue({
      ok: true,
      metadata: {
        owner: "Luisgb98",
        repo: "keystroke-hub",
        title: "GitHub Issue linking",
        state: "open",
      },
    });

    const result = await attachGithubIssue(target, "luisgb98/keystroke-hub#27");

    expect(result.linkId).toBeTruthy();
    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        improvementId: null,
        meetingNoteId: null,
        owner: "Luisgb98",
        repo: "keystroke-hub",
        issueNumber: 27,
        title: "GitHub Issue linking",
        state: "open",
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/projects/project-1");
  });

  it("still attaches with a null snapshot when the metadata fetch fails", async () => {
    dbMock.selectQueue.push([{ id: "project-1", archivedAt: null }]);
    dbMock.selectQueue.push([]);
    fetchIssueMetadata.mockResolvedValue({
      ok: false,
      reason: "rate_limited",
    });

    const result = await attachGithubIssue(target, "owner/repo#1");

    expect(result.linkId).toBeTruthy();
    expect(dbMock.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner",
        repo: "repo",
        issueNumber: 1,
        title: null,
        state: null,
        fetchedAt: null,
      })
    );
  });

  it("is idempotent when the issue is already linked to this item", async () => {
    dbMock.selectQueue.push([{ id: "project-1", archivedAt: null }]);
    dbMock.selectQueue.push([{ id: "existing-link" }]);

    const result = await attachGithubIssue(target, "owner/repo#1");

    expect(result).toEqual({ linkId: "existing-link" });
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(fetchIssueMetadata).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/projects/project-1");
  });

  it("revalidates the improvements backlog for an improvement target", async () => {
    dbMock.selectQueue.push([{ id: "improvement-1" }]);
    dbMock.selectQueue.push([]);
    fetchIssueMetadata.mockResolvedValue({ ok: false, reason: "not_found" });

    await attachGithubIssue(
      { type: "improvement", id: "improvement-1" },
      "owner/repo#1"
    );

    expect(revalidatePath).toHaveBeenCalledWith("/projects/improvements");
  });

  it("revalidates the meeting note detail page for a meeting note target", async () => {
    dbMock.selectQueue.push([{ id: "meeting-1" }]);
    dbMock.selectQueue.push([]);
    fetchIssueMetadata.mockResolvedValue({ ok: false, reason: "not_found" });

    await attachGithubIssue(
      { type: "meetingNote", id: "meeting-1" },
      "owner/repo#1"
    );

    expect(revalidatePath).toHaveBeenCalledWith("/projects/meetings/meeting-1");
  });
});

describe("detachGithubIssue", () => {
  it("verifies the session before writing", async () => {
    await detachGithubIssue("link-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("returns an error when the link no longer exists", async () => {
    dbMock.deleteReturning.mockResolvedValueOnce([]);
    const result = await detachGithubIssue("missing");
    expect(result).toEqual({ error: "That link no longer exists." });
  });

  it("deletes and revalidates the owning project's page", async () => {
    dbMock.deleteReturning.mockResolvedValueOnce([
      { projectId: "project-1", improvementId: null, meetingNoteId: null },
    ]);
    const result = await detachGithubIssue("link-1");
    expect(result).toEqual({});
    expect(revalidatePath).toHaveBeenCalledWith("/projects/project-1");
  });
});

describe("refreshGithubIssueLink", () => {
  it("verifies the session before writing", async () => {
    dbMock.selectQueue.push([]);
    await refreshGithubIssueLink("link-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("returns an error when the link no longer exists", async () => {
    dbMock.selectQueue.push([]);
    const result = await refreshGithubIssueLink("missing");
    expect(result).toEqual({ error: "That link no longer exists." });
  });

  it("returns a rate-limit specific error without updating", async () => {
    dbMock.selectQueue.push([
      {
        id: "link-1",
        owner: "owner",
        repo: "repo",
        issueNumber: 1,
        projectId: "project-1",
        improvementId: null,
        meetingNoteId: null,
      },
    ]);
    fetchIssueMetadata.mockResolvedValue({ ok: false, reason: "rate_limited" });

    const result = await refreshGithubIssueLink("link-1");

    expect(result.error).toBe(
      "GitHub rate-limited this request — try again later."
    );
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("updates the cached snapshot on success and revalidates", async () => {
    dbMock.selectQueue.push([
      {
        id: "link-1",
        owner: "owner",
        repo: "repo",
        issueNumber: 1,
        projectId: null,
        improvementId: "improvement-1",
        meetingNoteId: null,
      },
    ]);
    fetchIssueMetadata.mockResolvedValue({
      ok: true,
      metadata: {
        owner: "owner",
        repo: "repo",
        title: "New title",
        state: "closed",
      },
    });

    const result = await refreshGithubIssueLink("link-1");

    expect(result).toEqual({ linkId: "link-1" });
    expect(dbMock.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ title: "New title", state: "closed" })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/projects/improvements");
  });
});
