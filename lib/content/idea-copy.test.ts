import { describe, expect, it } from "vitest";

import type { Idea } from "@/lib/db/schema";
import {
  formatIdeaCopyBlocks,
  formatIdeaTags,
  type IdeaCopyBlockKey,
} from "./idea-copy";

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-1",
    title: "Speedrun any% commentary",
    notes: null,
    format: "either",
    status: "idea",
    tags: [],
    projectId: null,
    releaseEventId: null,
    releaseEventTrack: null,
    stageEnteredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function block(idea: Idea, key: IdeaCopyBlockKey) {
  const found = formatIdeaCopyBlocks(idea).find((b) => b.key === key);
  if (!found) throw new Error(`missing block ${key}`);
  return found;
}

describe("formatIdeaTags", () => {
  it("joins tags comma-separated", () => {
    expect(formatIdeaTags(["speedrun", "glitch", "boss rush"])).toBe(
      "speedrun, glitch, boss rush"
    );
  });

  it("keeps multi-word tags intact (no hashtag conversion)", () => {
    expect(formatIdeaTags(["boss rush"])).toBe("boss rush");
  });

  it("is empty for no tags", () => {
    expect(formatIdeaTags([])).toBe("");
  });
});

describe("formatIdeaCopyBlocks", () => {
  const full = makeIdea({
    title: "Glitch tutorial",
    notes: "First paragraph.\n\nSecond paragraph.",
    tags: ["speedrun", "glitch", "tutorial", "retro", "any%"],
  });

  it("returns the four blocks in button order", () => {
    expect(formatIdeaCopyBlocks(full).map((b) => b.key)).toEqual([
      "title",
      "title-tags",
      "description-tags",
      "tags",
    ]);
  });

  it("copies the title alone", () => {
    expect(block(full, "title").text).toBe("Glitch tutorial");
  });

  it("copies title, a blank line, then the tags", () => {
    expect(block(full, "title-tags").text).toBe(
      "Glitch tutorial\n\nspeedrun, glitch, tutorial, retro, any%"
    );
  });

  it("copies description, a blank line, then the tags", () => {
    expect(block(full, "description-tags").text).toBe(
      "First paragraph.\n\nSecond paragraph.\n\nspeedrun, glitch, tutorial, retro, any%"
    );
  });

  it("copies the tags alone", () => {
    expect(block(full, "tags").text).toBe(
      "speedrun, glitch, tutorial, retro, any%"
    );
  });

  it("preserves the author's line breaks in the description verbatim", () => {
    const idea = makeIdea({ notes: "Line one\nLine two\n\nAfter a gap" });
    expect(block(idea, "description-tags").text).toBe(
      "Line one\nLine two\n\nAfter a gap"
    );
  });

  describe("without tags", () => {
    const noTags = makeIdea({ notes: "Just a description", tags: [] });

    it("still copies the title", () => {
      expect(block(noTags, "title").text).toBe("Speedrun any% commentary");
    });

    it("disables title + tags (nothing distinct to copy)", () => {
      expect(block(noTags, "title-tags").text).toBeNull();
    });

    it("disables the tags-only block", () => {
      expect(block(noTags, "tags").text).toBeNull();
    });

    it("copies the description alone when there are no tags", () => {
      expect(block(noTags, "description-tags").text).toBe("Just a description");
    });
  });

  describe("without a description", () => {
    const noNotes = makeIdea({ notes: null, tags: ["speedrun", "glitch"] });

    it("disables description + tags", () => {
      expect(block(noNotes, "description-tags").text).toBeNull();
    });

    it("treats an empty-string description as absent", () => {
      const empty = makeIdea({ notes: "", tags: ["speedrun"] });
      expect(block(empty, "description-tags").text).toBeNull();
    });

    it("still copies title + tags and tags", () => {
      expect(block(noNotes, "title-tags").text).toBe(
        "Speedrun any% commentary\n\nspeedrun, glitch"
      );
      expect(block(noNotes, "tags").text).toBe("speedrun, glitch");
    });
  });

  it("copies fewer than the five-tag standard when that's all there is", () => {
    const idea = makeIdea({ tags: ["speedrun", "glitch"] });
    expect(block(idea, "tags").text).toBe("speedrun, glitch");
  });
});
