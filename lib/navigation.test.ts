import { describe, expect, it } from "vitest";

import {
  bottomNavItems,
  inboxNavItem,
  isMoreNavActive,
  isNavItemActive,
  moreNavItems,
  navItems,
  settingsNavItem,
} from "./navigation";

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

describe("mobile nav split (#114)", () => {
  it("gives the bottom bar four destinations, leaving the fifth slot for More", () => {
    // Five slots is the ceiling before labels wrap and tap targets get
    // cramped — the bar carried nine before this.
    expect(bottomNavItems).toHaveLength(4);
  });

  it("keeps every primary destination reachable from the bar in one tap", () => {
    // The whole point of the split: nothing may fall out of navigation. Each
    // primary item is either its own slot or a row in the More sheet.
    const reachable = new Set(
      [...bottomNavItems, ...moreNavItems].map((item) => item.href)
    );
    for (const item of navItems) {
      expect(reachable, item.label).toContain(item.href);
    }
  });

  it("draws the bar's items from navItems rather than restating them", () => {
    // Same object identity, so a relabelled nav item can't say one thing in
    // the sidebar and another in the bar.
    for (const item of bottomNavItems) {
      expect(navItems).toContain(item);
    }
  });

  it("puts the inbox and settings behind More, since neither has a bar slot", () => {
    expect(moreNavItems).toContain(inboxNavItem);
    expect(moreNavItems).toContain(settingsNavItem);
    expect(bottomNavItems).not.toContain(inboxNavItem);
  });

  it("has unique hrefs across the two lists", () => {
    const hrefs = [...bottomNavItems, ...moreNavItems].map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("labels and icons every More row", () => {
    for (const item of moreNavItems) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon).toBeDefined();
    }
  });
});

describe("isMoreNavActive", () => {
  it("is true on any destination that lives behind the More trigger", () => {
    expect(isMoreNavActive("/projects")).toBe(true);
    expect(isMoreNavActive("/inbox")).toBe(true);
    expect(isMoreNavActive("/settings/calendars")).toBe(true);
  });

  it("follows nested routes, so a meeting note still highlights More", () => {
    expect(isMoreNavActive("/projects/meetings/42")).toBe(true);
  });

  it("is false on a destination that has its own bar slot", () => {
    expect(isMoreNavActive("/")).toBe(false);
    expect(isMoreNavActive("/calendar")).toBe(false);
    expect(isMoreNavActive("/content/board")).toBe(false);
  });
});
