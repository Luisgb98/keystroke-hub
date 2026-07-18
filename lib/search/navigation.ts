import {
  CalendarRange,
  Columns3,
  Inbox,
  Lightbulb,
  ListChecks,
  Radio,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

import { navItems, type NavItem } from "@/lib/navigation";
import type { Track } from "@/lib/calendar/types";

export interface SearchNavItem extends NavItem {
  /** Absent for track-agnostic destinations (mirrors `navItems`'s Dashboard/Calendar/Projects & Meetings — see docs/command-palette.md). */
  world?: Track;
}

/**
 * Destinations reachable from the palette but with no slot in the primary
 * sidebar/bottom-nav (`lib/navigation.ts`) — extends that single source of
 * truth rather than duplicating it (see docs/command-palette.md).
 */
export const secondaryNavItems: SearchNavItem[] = [
  // Track-neutral (pre-classification) — no `world`, like Dashboard/Calendar.
  { href: "/inbox", label: "Inbox", icon: Inbox },
  {
    href: "/journal/week",
    label: "Weekly review",
    icon: CalendarRange,
    world: "work",
  },
  {
    href: "/journal/standup",
    label: "Standup prep",
    icon: ListChecks,
    world: "work",
  },
  { href: "/content/ideas", label: "Ideas", icon: Lightbulb, world: "content" },
  {
    href: "/content/board",
    label: "Content board",
    icon: Columns3,
    world: "content",
  },
  { href: "/content/streams", label: "Streams", icon: Radio, world: "content" },
  {
    href: "/projects/improvements",
    label: "Improvements",
    icon: Sparkles,
    world: "work",
  },
  {
    href: "/projects/meetings",
    label: "Meeting notes",
    icon: Users,
    world: "work",
  },
  {
    href: "/settings/calendars",
    label: "Calendar settings",
    icon: Settings,
    world: "work",
  },
];

/** Every navigable destination the palette offers — primary nav first, in registration order. */
export const allSearchNavItems: SearchNavItem[] = [
  ...navItems,
  ...secondaryNavItems,
];

/**
 * Case-insensitive substring match on label, split out so it's
 * unit-testable without rendering — the palette's `Command` root runs with
 * `shouldFilter={false}` (server results shouldn't be re-filtered by cmdk),
 * so navigation matching is done here instead (see docs/command-palette.md).
 */
export function filterNavItems(
  items: SearchNavItem[],
  query: string
): SearchNavItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter((item) => item.label.toLowerCase().includes(trimmed));
}
