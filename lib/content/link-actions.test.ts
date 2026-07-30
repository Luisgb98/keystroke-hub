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
  const selectWhere = vi.fn();
  const insertOnConflictDoNothing = vi.fn(() => Promise.resolve());
  const insertValues = vi.fn(() => ({
    onConflictDoNothing: insertOnConflictDoNothing,
  }));
  const deleteWhere = vi.fn(() => Promise.resolve());

  return {
    selectWhere,
    insertValues,
    insertOnConflictDoNothing,
    deleteWhere,
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: selectWhere })) })),
    insert: vi.fn(() => ({ values: insertValues })),
    delete: vi.fn(() => ({ where: deleteWhere })),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: () => dbMock,
}));

const searchLinkableIdeasQuery = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/idea-event-links", () => ({
  searchLinkableIdeas: searchLinkableIdeasQuery,
}));

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import {
  linkIdeaToEvent,
  searchLinkableIdeas,
  unlinkIdeaFromEvent,
} from "./link-actions";

beforeEach(() => {
  vi.mocked(verifySession).mockResolvedValue({ isAuth: true });
  dbMock.selectWhere.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("linkIdeaToEvent", () => {
  it("verifies the session before touching the database", async () => {
    await linkIdeaToEvent("evt-1", "idea-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated call before writing", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(linkIdeaToEvent("evt-1", "idea-1")).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("links a content-track event to an existing idea and revalidates both surfaces", async () => {
    dbMock.selectWhere
      .mockResolvedValueOnce([{ id: "evt-1", track: "content" }])
      .mockResolvedValueOnce([{ id: "idea-1" }]);

    const result = await linkIdeaToEvent("evt-1", "idea-1");

    expect(result).toEqual({});
    expect(dbMock.insertValues).toHaveBeenCalledWith({
      ideaId: "idea-1",
      eventId: "evt-1",
      eventTrack: "content",
    });
    expect(dbMock.insertOnConflictDoNothing).toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.any(Array) })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
    expect(revalidatePath).toHaveBeenCalledWith("/content/ideas");
  });

  it("rejects a work-track event without writing", async () => {
    dbMock.selectWhere.mockResolvedValueOnce([{ id: "evt-1", track: "work" }]);

    const result = await linkIdeaToEvent("evt-1", "idea-1");

    expect(result).toEqual({
      error: "Only content-track events can link to ideas.",
    });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("returns an error (not a throw) when the event doesn't exist", async () => {
    dbMock.selectWhere.mockResolvedValueOnce([]);

    const result = await linkIdeaToEvent("missing", "idea-1");

    expect(result).toEqual({ error: "That event no longer exists." });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("returns an error (not a throw) when the idea doesn't exist", async () => {
    dbMock.selectWhere
      .mockResolvedValueOnce([{ id: "evt-1", track: "content" }])
      .mockResolvedValueOnce([]);

    const result = await linkIdeaToEvent("evt-1", "missing");

    expect(result).toEqual({ error: "That idea no longer exists." });
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it("rejects an invalid (empty) id without touching the database", async () => {
    const result = await linkIdeaToEvent("", "idea-1");
    expect(result).toEqual({ error: "That link isn't valid." });
    expect(dbMock.select).not.toHaveBeenCalled();
  });
});

describe("unlinkIdeaFromEvent", () => {
  it("verifies the session before touching the database", async () => {
    await unlinkIdeaFromEvent("evt-1", "idea-1");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthenticated call before deleting", async () => {
    vi.mocked(verifySession).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/login")
    );
    await expect(unlinkIdeaFromEvent("evt-1", "idea-1")).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
    expect(dbMock.delete).not.toHaveBeenCalled();
  });

  it("deletes the link and revalidates both surfaces", async () => {
    const result = await unlinkIdeaFromEvent("evt-1", "idea-1");

    expect(result).toEqual({});
    expect(dbMock.delete).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
    expect(revalidatePath).toHaveBeenCalledWith("/content/ideas");
  });

  it("is a no-op, not an error, when the link doesn't exist", async () => {
    const result = await unlinkIdeaFromEvent("evt-1", "never-linked");
    expect(result).toEqual({});
  });
});

describe("searchLinkableIdeas", () => {
  it("verifies the session before querying", async () => {
    searchLinkableIdeasQuery.mockResolvedValue([]);
    await searchLinkableIdeas("evt-1", "");
    expect(verifySession).toHaveBeenCalledTimes(1);
  });

  it("delegates to the data-layer query with the same arguments", async () => {
    const ideas = [
      {
        id: "idea-1",
        title: "Glitch tutorial",
        format: "video",
        status: "idea",
      },
    ];
    searchLinkableIdeasQuery.mockResolvedValue(ideas);

    const result = await searchLinkableIdeas("evt-1", "glitch");

    expect(searchLinkableIdeasQuery).toHaveBeenCalledWith("evt-1", "glitch");
    expect(result).toEqual(ideas);
  });
});
