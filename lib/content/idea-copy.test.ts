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
    description: null,
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
  it("joins tags as space-separated hashtags", () => {
    expect(formatIdeaTags(["speedrun", "glitch", "movement"])).toBe(
      "#speedrun #glitch #movement"
    );
  });

  it("collapses a multi-word tag into a single hashtag", () => {
    expect(formatIdeaTags(["boss rush"])).toBe("#bossrush");
    expect(formatIdeaTags(["death awakening", "glitch"])).toBe(
      "#deathawakening #glitch"
    );
  });

  it("is empty for no tags", () => {
    expect(formatIdeaTags([])).toBe("");
  });
});

describe("formatIdeaCopyBlocks", () => {
  const full = makeIdea({
    title: "Glitch tutorial",
    description: "First paragraph.\n\nSecond paragraph.",
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
      "Glitch tutorial\n\n#speedrun #glitch #tutorial #retro #any%"
    );
  });

  it("copies description, a blank line, then the tags", () => {
    expect(block(full, "description-tags").text).toBe(
      "First paragraph.\n\nSecond paragraph.\n\n#speedrun #glitch #tutorial #retro #any%"
    );
  });

  it("copies the tags alone", () => {
    expect(block(full, "tags").text).toBe(
      "#speedrun #glitch #tutorial #retro #any%"
    );
  });

  it("preserves the author's line breaks in the description verbatim", () => {
    const idea = makeIdea({
      description: "Line one\nLine two\n\nAfter a gap",
    });
    expect(block(idea, "description-tags").text).toBe(
      "Line one\nLine two\n\nAfter a gap"
    );
  });

  describe("without tags", () => {
    const noTags = makeIdea({ description: "Just a description", tags: [] });

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
    const noDescription = makeIdea({
      description: null,
      tags: ["speedrun", "glitch"],
    });

    it("disables description + tags", () => {
      expect(block(noDescription, "description-tags").text).toBeNull();
    });

    it("treats an empty-string description as absent", () => {
      const empty = makeIdea({ description: "", tags: ["speedrun"] });
      expect(block(empty, "description-tags").text).toBeNull();
    });

    it("still copies title + tags and tags", () => {
      expect(block(noDescription, "title-tags").text).toBe(
        "Speedrun any% commentary\n\n#speedrun #glitch"
      );
      expect(block(noDescription, "tags").text).toBe("#speedrun #glitch");
    });
  });

  it("collapses a multi-word tag inside every tag-bearing block", () => {
    const idea = makeIdea({
      title: "Boss guide",
      description: "How to beat it.",
      tags: ["death awakening", "glifos"],
    });
    expect(block(idea, "tags").text).toBe("#deathawakening #glifos");
    expect(block(idea, "title-tags").text).toBe(
      "Boss guide\n\n#deathawakening #glifos"
    );
    expect(block(idea, "description-tags").text).toBe(
      "How to beat it.\n\n#deathawakening #glifos"
    );
  });

  it("copies fewer than the five-tag standard when that's all there is", () => {
    const idea = makeIdea({ tags: ["speedrun", "glitch"] });
    expect(block(idea, "tags").text).toBe("#speedrun #glitch");
  });
});
