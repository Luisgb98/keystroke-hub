// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/content/core/ideas", () => ({
  createIdeaCore: vi.fn(),
  updateIdeaCore: vi.fn(),
  updateIdeaStatusCore: vi.fn(),
  setIdeaReleaseCore: vi.fn(),
  clearIdeaReleaseCore: vi.fn(),
  deleteIdeaCore: vi.fn(),
}));
vi.mock("@/lib/data/ideas", () => ({
  getIdeas: vi.fn(),
  getDistinctIdeaTags: vi.fn(),
}));
vi.mock("@/lib/data/games", () => ({ getGamesById: vi.fn() }));
vi.mock("@/lib/data/idea-checklists", () => ({
  getIdeaChecklistItems: vi.fn(),
}));
vi.mock("@/lib/data/idea-event-links", () => ({
  getScheduledEventsForIdeas: vi.fn(),
}));
vi.mock("@/lib/data/scripts", () => ({
  getIdeaIdsWithScripts: vi.fn(),
  getIdeaWithScript: vi.fn(),
}));

import {
  clearIdeaReleaseCore,
  createIdeaCore,
  deleteIdeaCore,
  setIdeaReleaseCore,
  updateIdeaCore,
  updateIdeaStatusCore,
} from "@/lib/content/core/ideas";
import { getGamesById } from "@/lib/data/games";
import { getIdeaChecklistItems } from "@/lib/data/idea-checklists";
import { getScheduledEventsForIdeas } from "@/lib/data/idea-event-links";
import { getDistinctIdeaTags, getIdeas } from "@/lib/data/ideas";
import { getIdeaIdsWithScripts, getIdeaWithScript } from "@/lib/data/scripts";
import type { Idea } from "@/lib/db/schema";

import { ideaTools } from "./ideas";
import { callTool, payloadOf } from "./test-support";

const RELEASE_EVENT = {
  id: "evt-release",
  title: "Release: Speedrun any%",
  // 19:00 Madrid on 2026-08-01 == 17:00Z (CEST, +02:00).
  startsAt: new Date("2026-08-01T17:00:00.000Z"),
  endsAt: new Date("2026-08-01T18:00:00.000Z"),
  allDay: false,
};

function idea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Speedrun any%",
    description: "Commentary run",
    format: "video",
    status: "scripted",
    tags: ["speedrun", "glitch"],
    gameId: "game-1",
    releaseEventId: "evt-release",
    releaseEventTrack: "content",
    createdAt: new Date("2026-07-01T09:00:00.000Z"),
    stageEnteredAt: new Date("2026-07-02T09:00:00.000Z"),
    ...overrides,
  } as Idea;
}

const GAME = {
  id: "game-1",
  name: "Path of Exile 2",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGamesById).mockResolvedValue(new Map([[GAME.id, GAME]]));
  vi.mocked(getIdeaIdsWithScripts).mockResolvedValue(new Set(["idea-1"]));
  vi.mocked(getScheduledEventsForIdeas).mockResolvedValue(
    new Map([["idea-1", [RELEASE_EVENT]]])
  );
  vi.mocked(getIdeaChecklistItems).mockResolvedValue([]);
});

describe("list_ideas", () => {
  it("passes every UI filter straight through to the query", async () => {
    vi.mocked(getIdeas).mockResolvedValue([]);
    await callTool(ideaTools, "list_ideas", {
      q: "speedrun",
      format: "video",
      status: "scripted",
      tag: "glitch",
      game: "game-1",
    });
    expect(getIdeas).toHaveBeenCalledWith({
      q: "speedrun",
      format: "video",
      status: "scripted",
      tag: "glitch",
      game: "game-1",
    });
  });

  it("resolves the game name and the release slot for each idea", async () => {
    vi.mocked(getIdeas).mockResolvedValue([idea()]);
    const body = payloadOf(await callTool(ideaTools, "list_ideas"));

    expect(body.count).toBe(1);
    expect(body.ideas[0]).toMatchObject({
      id: "idea-1",
      game: { id: "game-1", name: "Path of Exile 2" },
      hasScript: true,
      tags: ["speedrun", "glitch"],
    });
    // The wall clock is the owner's, not the server's UTC (issue #95).
    expect(body.ideas[0].release).toEqual({
      eventId: "evt-release",
      at: "2026-08-01T17:00:00.000Z",
      date: "2026-08-01",
      time: "19:00",
    });
  });

  it("reports no release for an unscheduled idea", async () => {
    vi.mocked(getIdeas).mockResolvedValue([
      idea({ releaseEventId: null, releaseEventTrack: null }),
    ]);
    vi.mocked(getScheduledEventsForIdeas).mockResolvedValue(new Map());
    const body = payloadOf(await callTool(ideaTools, "list_ideas"));
    expect(body.ideas[0].release).toBeNull();
  });
});

describe("get_idea", () => {
  it("returns the script, the checklist and every linked event", async () => {
    vi.mocked(getIdeaWithScript).mockResolvedValue({
      idea: idea(),
      script: {
        id: "script-1",
        ideaId: "idea-1",
        content: "# Intro",
        createdAt: new Date("2026-07-01T09:00:00.000Z"),
        updatedAt: new Date("2026-07-03T09:00:00.000Z"),
      },
    });
    vi.mocked(getIdeaChecklistItems).mockResolvedValue([
      {
        id: "item-1",
        ideaId: "idea-1",
        label: "Thumbnail",
        done: false,
        position: 0,
        createdAt: new Date("2026-07-01T09:00:00.000Z"),
        updatedAt: new Date("2026-07-01T09:00:00.000Z"),
      },
    ]);

    const body = payloadOf(
      await callTool(ideaTools, "get_idea", { ideaId: "idea-1" })
    );
    expect(body.script).toEqual({
      content: "# Intro",
      updatedAt: "2026-07-03T09:00:00.000Z",
    });
    expect(body.checklist).toEqual([
      { id: "item-1", label: "Thumbnail", done: false, position: 0 },
    ]);
    // The managed release event is flagged so a client doesn't treat it as an
    // ordinary link it may unlink.
    expect(body.linkedEvents[0]).toMatchObject({
      id: "evt-release",
      isRelease: true,
    });
  });

  it("fails cleanly for an unknown idea", async () => {
    vi.mocked(getIdeaWithScript).mockResolvedValue(null);
    const result = await callTool(ideaTools, "get_idea", { ideaId: "gone" });
    expect(result.isError).toBe(true);
    expect(payloadOf(result).message).toBe("That idea no longer exists.");
  });
});

describe("create_idea", () => {
  it("joins tags back into the one raw string normalizeTags owns", async () => {
    vi.mocked(createIdeaCore).mockResolvedValue({
      success: true,
      ideaId: "idea-new",
    });
    const body = payloadOf(
      await callTool(ideaTools, "create_idea", {
        title: "Glitch tutorial",
        tags: ["Speedrun", "glitch"],
        releaseDate: "2026-08-01",
      })
    );
    expect(createIdeaCore).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Glitch tutorial",
        tags: "Speedrun,glitch",
        releaseDate: "2026-08-01",
        // Left undefined on purpose — the 19:00 default is the domain's, not
        // the tool's, so both doors can never drift apart.
        releaseTime: undefined,
      })
    );
    expect(body).toEqual({ ideaId: "idea-new" });
  });

  it("surfaces the domain's field errors verbatim", async () => {
    vi.mocked(createIdeaCore).mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: {
        tags: ["Keep it to 5 tags — that's the publishing standard."],
      },
    });
    const result = await callTool(ideaTools, "create_idea", { title: "x" });
    expect(result.isError).toBe(true);
    expect(payloadOf(result)).toMatchObject({
      message: "Check the highlighted fields.",
      fieldErrors: {
        tags: ["Keep it to 5 tags — that's the publishing standard."],
      },
    });
  });
});

describe("update_idea", () => {
  it("forwards the id separately from the fields", async () => {
    vi.mocked(updateIdeaCore).mockResolvedValue({ success: true });
    await callTool(ideaTools, "update_idea", {
      ideaId: "idea-1",
      title: "Edited",
      tags: ["speedrun"],
    });
    expect(updateIdeaCore).toHaveBeenCalledWith(
      "idea-1",
      expect.objectContaining({ title: "Edited", tags: "speedrun" })
    );
  });
});

describe("set_idea_status", () => {
  it("reports the unticked publish-checklist count when publishing", async () => {
    vi.mocked(updateIdeaStatusCore).mockResolvedValue({ uncheckedCount: 2 });
    const body = payloadOf(
      await callTool(ideaTools, "set_idea_status", {
        ideaId: "idea-1",
        status: "published",
      })
    );
    expect(body).toEqual({
      ideaId: "idea-1",
      status: "published",
      uncheckedChecklistItems: 2,
    });
  });

  it("fails on a status the pipeline doesn't have", async () => {
    vi.mocked(updateIdeaStatusCore).mockResolvedValue({
      error: "That status isn't valid.",
    });
    const result = await callTool(ideaTools, "set_idea_status", {
      ideaId: "idea-1",
      status: "parked",
    });
    expect(result.isError).toBe(true);
  });
});

describe("schedule_idea_release", () => {
  it("passes the day and time through and reports the 19:00 default back", async () => {
    vi.mocked(setIdeaReleaseCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(ideaTools, "schedule_idea_release", {
        ideaId: "idea-1",
        releaseDate: "2026-08-07",
      })
    );
    expect(setIdeaReleaseCore).toHaveBeenCalledWith(
      "idea-1",
      "2026-08-07",
      undefined
    );
    expect(body).toEqual({
      ideaId: "idea-1",
      releaseDate: "2026-08-07",
      releaseTime: "19:00",
    });
  });

  it("surfaces a release the idea can't have", async () => {
    vi.mocked(setIdeaReleaseCore).mockResolvedValue({
      error: "That idea no longer exists.",
    });
    const result = await callTool(ideaTools, "schedule_idea_release", {
      ideaId: "gone",
      releaseDate: "2026-08-07",
    });
    expect(result.isError).toBe(true);
  });
});

describe("clear_idea_release", () => {
  it("reports the release as gone", async () => {
    vi.mocked(clearIdeaReleaseCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(ideaTools, "clear_idea_release", { ideaId: "idea-1" })
    );
    expect(body).toEqual({ ideaId: "idea-1", release: null });
  });
});

describe("delete_idea", () => {
  it("confirms the delete", async () => {
    vi.mocked(deleteIdeaCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(ideaTools, "delete_idea", { ideaId: "idea-1" })
    );
    expect(body).toEqual({ ideaId: "idea-1", deleted: true });
  });

  it("fails on an idea that's already gone", async () => {
    vi.mocked(deleteIdeaCore).mockResolvedValue({
      error: "That idea no longer exists.",
    });
    const result = await callTool(ideaTools, "delete_idea", { ideaId: "gone" });
    expect(result.isError).toBe(true);
  });
});

describe("list_tags", () => {
  it("returns the distinct tags in use", async () => {
    vi.mocked(getDistinctIdeaTags).mockResolvedValue(["glitch", "speedrun"]);
    const body = payloadOf(await callTool(ideaTools, "list_tags"));
    expect(body).toEqual({ tags: ["glitch", "speedrun"] });
  });
});
