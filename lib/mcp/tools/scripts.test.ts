// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/content/core/scripts", () => ({ saveScriptCore: vi.fn() }));
vi.mock("@/lib/data/scripts", () => ({ getIdeaWithScript: vi.fn() }));

import { saveScriptCore } from "@/lib/content/core/scripts";
import { getIdeaWithScript } from "@/lib/data/scripts";
import type { Idea } from "@/lib/db/schema";

import { scriptTools } from "./scripts";
import { callTool, payloadOf } from "./test-support";

const IDEA = {
  id: "idea-1",
  title: "Speedrun any%",
  description: null,
  format: "video",
  status: "scripted",
  tags: [],
  gameId: null,
  releaseEventId: null,
  releaseEventTrack: null,
  projectId: null,
  createdAt: new Date("2026-07-01T09:00:00.000Z"),
  updatedAt: new Date("2026-07-01T09:00:00.000Z"),
  stageEnteredAt: new Date("2026-07-01T09:00:00.000Z"),
} as Idea;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("get_script", () => {
  it("returns the saved Markdown", async () => {
    vi.mocked(getIdeaWithScript).mockResolvedValue({
      idea: IDEA,
      script: {
        id: "script-1",
        ideaId: "idea-1",
        content: "# Intro\n\nSay hi",
        createdAt: new Date("2026-07-01T09:00:00.000Z"),
        updatedAt: new Date("2026-07-03T09:00:00.000Z"),
      },
    });
    const body = payloadOf(
      await callTool(scriptTools, "get_script", { ideaId: "idea-1" })
    );
    expect(body).toEqual({
      ideaId: "idea-1",
      title: "Speedrun any%",
      content: "# Intro\n\nSay hi",
      updatedAt: "2026-07-03T09:00:00.000Z",
    });
  });

  it("reports null content when nothing has been written yet", async () => {
    vi.mocked(getIdeaWithScript).mockResolvedValue({
      idea: IDEA,
      script: null,
    });
    const body = payloadOf(
      await callTool(scriptTools, "get_script", { ideaId: "idea-1" })
    );
    expect(body).toMatchObject({ content: null, updatedAt: null });
  });

  it("fails cleanly for an unknown idea", async () => {
    vi.mocked(getIdeaWithScript).mockResolvedValue(null);
    const result = await callTool(scriptTools, "get_script", {
      ideaId: "gone",
    });
    expect(result.isError).toBe(true);
  });
});

describe("save_script", () => {
  it("upserts the whole script and reports the new timestamp", async () => {
    vi.mocked(saveScriptCore).mockResolvedValue({
      updatedAt: new Date("2026-07-05T09:00:00.000Z"),
    });
    const body = payloadOf(
      await callTool(scriptTools, "save_script", {
        ideaId: "idea-1",
        content: "# Rewritten",
      })
    );
    expect(saveScriptCore).toHaveBeenCalledWith("idea-1", "# Rewritten");
    expect(body).toEqual({
      ideaId: "idea-1",
      updatedAt: "2026-07-05T09:00:00.000Z",
    });
  });

  it("surfaces the length cap the script page shares", async () => {
    vi.mocked(saveScriptCore).mockResolvedValue({
      error: "That script is too long — keep it under 200,000 characters.",
    });
    const result = await callTool(scriptTools, "save_script", {
      ideaId: "idea-1",
      content: "x",
    });
    expect(result.isError).toBe(true);
    expect(payloadOf(result).message).toContain("200,000");
  });

  it("fails on an idea that no longer exists", async () => {
    vi.mocked(saveScriptCore).mockResolvedValue({
      error: "That idea no longer exists.",
    });
    const result = await callTool(scriptTools, "save_script", {
      ideaId: "gone",
      content: "x",
    });
    expect(result.isError).toBe(true);
  });
});
