// @vitest-environment node
import { describe, expect, it } from "vitest";

import { contentTools } from "./server";

/**
 * Surface-level guarantees about the tool catalogue itself — the ones a client
 * (and the two-worlds separation) depends on before any handler runs.
 */

describe("the MCP tool catalogue", () => {
  it("has unique names", () => {
    const names = contentTools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every tool a title, a description and an input schema", () => {
    for (const tool of contentTools) {
      expect(tool.config.title, tool.name).toBeTruthy();
      expect(tool.config.description, tool.name).toBeTruthy();
      expect(tool.config.inputSchema, tool.name).toBeDefined();
    }
  });

  it("flags every delete tool as destructive", () => {
    const deletes = contentTools.filter((tool) =>
      tool.name.startsWith("delete_")
    );
    expect(deletes.length).toBeGreaterThan(0);
    for (const tool of deletes) {
      expect(tool.config.annotations?.destructiveHint, tool.name).toBe(true);
    }
  });

  // A client's only chance to warn the user is the description it reads — so
  // every irreversible delete has to say so in words, not just an annotation.
  it("warns in words that a delete has no undo", () => {
    for (const tool of contentTools.filter((candidate) =>
      candidate.name.startsWith("delete_")
    )) {
      expect(tool.config.description.toLowerCase(), tool.name).toContain(
        "no undo"
      );
    }
  });

  // The work world is out of reach by design: no tool names it, and every
  // calendar tool is content-track only (issue #109).
  it("exposes no work-world tool", () => {
    const forbidden = [
      "task",
      "daily_log",
      "weekly",
      "meeting",
      "project",
      "journal",
      "inbox",
      "improvement",
    ];
    for (const tool of contentTools) {
      for (const word of forbidden) {
        expect(tool.name, `${tool.name} names the work world`).not.toContain(
          word
        );
      }
    }
  });

  it("only exposes calendar tools that say content", () => {
    const calendarTools = contentTools
      .map((tool) => tool.name)
      .filter((name) => name.includes("event"));
    // Idea/stream links and the attach picker are content-scoped by their
    // domain; the calendar CRUD tools carry the track in their very name.
    expect(calendarTools).toEqual([
      "search_attachable_events",
      "link_idea_to_event",
      "unlink_idea_from_event",
      "list_content_events",
      "create_content_event",
      "reschedule_content_event",
      "delete_content_event",
    ]);
  });
});
