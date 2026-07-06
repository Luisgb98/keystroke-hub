import { describe, expect, it } from "vitest";

import { isNavItemActive, navItems } from "./navigation";

describe("navItems", () => {
  it("has exactly 5 items", () => {
    expect(navItems).toHaveLength(5);
  });

  it("has unique, well-formed hrefs", () => {
    const hrefs = navItems.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) {
      expect(href).toMatch(/^\/[a-z]*$/);
    }
  });

  it("every item has a label and an icon", () => {
    for (const item of navItems) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon).toBeDefined();
    }
  });
});

describe("isNavItemActive", () => {
  it("matches / only on exact pathname", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/calendar", "/")).toBe(false);
  });

  it("matches a section href exactly", () => {
    expect(isNavItemActive("/calendar", "/calendar")).toBe(true);
  });

  it("matches nested routes under a section via prefix", () => {
    expect(isNavItemActive("/calendar/2026-07-06", "/calendar")).toBe(true);
  });

  it("does not match unrelated routes or partial segment collisions", () => {
    expect(isNavItemActive("/content", "/calendar")).toBe(false);
    expect(isNavItemActive("/calendar-export", "/calendar")).toBe(false);
  });
});
