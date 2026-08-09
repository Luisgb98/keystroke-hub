// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/content/core/links", () => ({
  linkIdeaToEventCore: vi.fn(),
  unlinkIdeaFromEventCore: vi.fn(),
}));
vi.mock("@/lib/content/core/checklists", () => ({
  toggleIdeaChecklistItemCore: vi.fn(),
  addIdeaChecklistItemCore: vi.fn(),
  removeIdeaChecklistItemCore: vi.fn(),
}));
vi.mock("@/lib/data/idea-event-links", () => ({
  searchLinkableIdeas: vi.fn(),
}));

import {
  addIdeaChecklistItemCore,
  removeIdeaChecklistItemCore,
  toggleIdeaChecklistItemCore,
} from "@/lib/content/core/checklists";
import {
  linkIdeaToEventCore,
  unlinkIdeaFromEventCore,
} from "@/lib/content/core/links";
import { searchLinkableIdeas } from "@/lib/data/idea-event-links";

import { linkTools } from "./links";
import { callTool, payloadOf } from "./test-support";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("link_idea_to_event", () => {
  it("calls the domain with the event first, the idea second", async () => {
    vi.mocked(linkIdeaToEventCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(linkTools, "link_idea_to_event", {
        ideaId: "idea-1",
        eventId: "evt-1",
      })
    );
    expect(linkIdeaToEventCore).toHaveBeenCalledWith("evt-1", "idea-1");
    expect(body).toEqual({ ideaId: "idea-1", eventId: "evt-1", linked: true });
  });

  // The work track is unreachable through MCP; this is the refusal a client sees.
  it("surfaces the content-track-only refusal", async () => {
    vi.mocked(linkIdeaToEventCore).mockResolvedValue({
      error: "Only content-track events can link to ideas.",
    });
    const result = await callTool(linkTools, "link_idea_to_event", {
      ideaId: "idea-1",
      eventId: "evt-work",
    });
    expect(result.isError).toBe(true);
    expect(payloadOf(result).message).toContain("content-track");
  });
});

describe("unlink_idea_from_event", () => {
  it("reports the link as gone", async () => {
    vi.mocked(unlinkIdeaFromEventCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(linkTools, "unlink_idea_from_event", {
        ideaId: "idea-1",
        eventId: "evt-1",
      })
    );
    expect(unlinkIdeaFromEventCore).toHaveBeenCalledWith("evt-1", "idea-1");
    expect(body).toMatchObject({ linked: false });
  });
});

describe("search_linkable_ideas", () => {
  it("defaults to an empty query", async () => {
    vi.mocked(searchLinkableIdeas).mockResolvedValue([]);
    const body = payloadOf(
      await callTool(linkTools, "search_linkable_ideas", { eventId: "evt-1" })
    );
    expect(searchLinkableIdeas).toHaveBeenCalledWith("evt-1", "");
    expect(body).toEqual({ count: 0, ideas: [] });
  });
});

describe("publish checklist tools", () => {
  it("ticks an item", async () => {
    vi.mocked(toggleIdeaChecklistItemCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(linkTools, "set_idea_checklist_item", {
        ideaId: "idea-1",
        itemId: "item-1",
        done: true,
      })
    );
    expect(toggleIdeaChecklistItemCore).toHaveBeenCalledWith(
      "idea-1",
      "item-1",
      true
    );
    expect(body).toMatchObject({ done: true });
  });

  it("fails on an item that no longer exists", async () => {
    vi.mocked(toggleIdeaChecklistItemCore).mockResolvedValue({
      error: "That checklist item no longer exists.",
    });
    const result = await callTool(linkTools, "set_idea_checklist_item", {
      ideaId: "idea-1",
      itemId: "gone",
      done: true,
    });
    expect(result.isError).toBe(true);
  });

  it("adds an item to one idea's checklist", async () => {
    vi.mocked(addIdeaChecklistItemCore).mockResolvedValue({});
    await callTool(linkTools, "add_idea_checklist_item", {
      ideaId: "idea-1",
      label: "End screen",
    });
    expect(addIdeaChecklistItemCore).toHaveBeenCalledWith(
      "idea-1",
      "End screen"
    );
  });

  it("rejects an empty label", async () => {
    vi.mocked(addIdeaChecklistItemCore).mockResolvedValue({
      error: "Label is required",
    });
    const result = await callTool(linkTools, "add_idea_checklist_item", {
      ideaId: "idea-1",
      label: "  ",
    });
    expect(result.isError).toBe(true);
  });

  it("removes an item", async () => {
    vi.mocked(removeIdeaChecklistItemCore).mockResolvedValue({});
    const body = payloadOf(
      await callTool(linkTools, "remove_idea_checklist_item", {
        ideaId: "idea-1",
        itemId: "item-1",
      })
    );
    expect(body).toMatchObject({ removed: true });
  });
});
