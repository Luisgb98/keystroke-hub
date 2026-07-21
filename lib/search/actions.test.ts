// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  verifySession: vi.fn(),
}));

const searchEntitiesMock = vi.hoisted(() => vi.fn());
const getRecentItemsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/search", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/data/search")>(
      "@/lib/data/search"
    );
  return {
    ...actual,
    searchEntities: searchEntitiesMock,
    getRecentItems: getRecentItemsMock,
  };
});

import { verifySession } from "@/lib/auth/session";
import { emptySearchResultGroups } from "@/lib/data/search";

import { getRecentPaletteItems, searchAll } from "./actions";

describe("searchAll", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("verifies the session before doing anything else", async () => {
    await searchAll("speedrun");
    expect(verifySession).toHaveBeenCalled();
  });

  it("short-circuits to empty groups for a blank query without querying the database", async () => {
    const result = await searchAll("   ");
    expect(result).toEqual(emptySearchResultGroups());
    expect(searchEntitiesMock).not.toHaveBeenCalled();
  });

  it("trims the query and forwards it to searchEntities", async () => {
    searchEntitiesMock.mockResolvedValue(emptySearchResultGroups());
    await searchAll("  speedrun  ");
    expect(searchEntitiesMock).toHaveBeenCalledWith("speedrun");
  });
});

describe("getRecentPaletteItems", () => {
  it("verifies the session and delegates to getRecentItems", async () => {
    getRecentItemsMock.mockResolvedValue([]);
    await getRecentPaletteItems();
    expect(verifySession).toHaveBeenCalled();
    expect(getRecentItemsMock).toHaveBeenCalled();
  });
});
