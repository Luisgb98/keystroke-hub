import { describe, expect, it } from "vitest";

import { navItems } from "@/lib/navigation";

import {
  allSearchNavItems,
  filterNavItems,
  secondaryNavItems,
} from "./navigation";

describe("secondaryNavItems", () => {
  it("includes every documented secondary destination with a valid href/label/world", () => {
    const expected = [
      { href: "/inbox", label: "Inbox", world: undefined },
      { href: "/journal/week", label: "Weekly review", world: "work" },
      { href: "/journal/standup", label: "Standup prep", world: "work" },
      { href: "/content/ideas", label: "Ideas", world: "content" },
      { href: "/content/board", label: "Content board", world: "content" },
      { href: "/content/streams", label: "Streams", world: "content" },
      {
        href: "/projects/improvements",
        label: "Improvements",
        world: "work",
      },
      { href: "/projects/meetings", label: "Meeting notes", world: "work" },
      {
        href: "/settings/calendars",
        label: "Calendar settings",
        world: "work",
      },
    ];

    expect(secondaryNavItems).toHaveLength(expected.length);
    for (const item of expected) {
      const match = secondaryNavItems.find((entry) => entry.href === item.href);
      expect(match).toBeDefined();
      expect(match?.label).toBe(item.label);
      expect(match?.world).toBe(item.world);
      expect(match?.icon).toBeDefined();
    }
  });
});

describe("allSearchNavItems", () => {
  it("combines primary nav items with secondary destinations, primary first", () => {
    expect(allSearchNavItems.slice(0, navItems.length)).toEqual(navItems);
    expect(allSearchNavItems.slice(navItems.length)).toEqual(secondaryNavItems);
  });

  it("has no duplicate hrefs", () => {
    const hrefs = allSearchNavItems.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("filterNavItems", () => {
  it("returns every item for a blank query", () => {
    expect(filterNavItems(allSearchNavItems, "")).toEqual(allSearchNavItems);
    expect(filterNavItems(allSearchNavItems, "   ")).toEqual(allSearchNavItems);
  });

  it("matches case-insensitively on label substring", () => {
    const result = filterNavItems(allSearchNavItems, "journal");
    expect(result.map((item) => item.label)).toEqual(["Journal"]);

    const result2 = filterNavItems(allSearchNavItems, "STANDUP");
    expect(result2.map((item) => item.label)).toEqual(["Standup prep"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterNavItems(allSearchNavItems, "zzz-no-such-item")).toEqual([]);
  });
});
