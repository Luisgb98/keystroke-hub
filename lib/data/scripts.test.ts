// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => {
  const selectWhere = vi.fn();
  return {
    selectWhere,
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: selectWhere })) })),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: () => dbMock,
}));

import { getIdeaIdsWithScripts, getIdeaWithScript } from "./scripts";

const idea = { id: "idea-1", title: "Speedrun commentary" };
const script = { id: "script-1", ideaId: "idea-1", content: "# Hi" };

beforeEach(() => {
  dbMock.selectWhere.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getIdeaWithScript", () => {
  it("returns null without querying for a script when the idea doesn't exist", async () => {
    dbMock.selectWhere.mockResolvedValueOnce([]);
    const result = await getIdeaWithScript("missing");
    expect(result).toBeNull();
    expect(dbMock.select).toHaveBeenCalledTimes(1);
  });

  it("returns the idea with a null script when none has been saved", async () => {
    dbMock.selectWhere.mockResolvedValueOnce([idea]).mockResolvedValueOnce([]);
    const result = await getIdeaWithScript("idea-1");
    expect(result).toEqual({ idea, script: null });
  });

  it("returns the idea with its saved script", async () => {
    dbMock.selectWhere
      .mockResolvedValueOnce([idea])
      .mockResolvedValueOnce([script]);
    const result = await getIdeaWithScript("idea-1");
    expect(result).toEqual({ idea, script });
  });
});

describe("getIdeaIdsWithScripts", () => {
  it("returns a set of idea ids with a non-empty script", async () => {
    dbMock.selectWhere.mockResolvedValueOnce([
      { ideaId: "idea-1" },
      { ideaId: "idea-2" },
    ]);
    const result = await getIdeaIdsWithScripts();
    expect(result).toEqual(new Set(["idea-1", "idea-2"]));
  });

  it("returns an empty set when no scripts have been saved", async () => {
    dbMock.selectWhere.mockResolvedValueOnce([]);
    const result = await getIdeaIdsWithScripts();
    expect(result).toEqual(new Set());
  });
});
