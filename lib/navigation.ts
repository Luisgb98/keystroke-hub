import {
  Briefcase,
  CalendarDays,
  Clapperboard,
  Inbox,
  LayoutDashboard,
  NotebookPen,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const dashboard: NavItem = {
  href: "/",
  label: "Dashboard",
  icon: LayoutDashboard,
};
const calendar: NavItem = {
  href: "/calendar",
  label: "Calendar",
  icon: CalendarDays,
};
const content: NavItem = {
  href: "/content",
  label: "Content",
  icon: Clapperboard,
};
const journal: NavItem = {
  href: "/journal",
  label: "Journal",
  icon: NotebookPen,
};
const projects: NavItem = {
  href: "/projects",
  label: "Projects & Meetings",
  icon: Briefcase,
};

/** The inbox destination, shared so the sidebar and the "More" sheet can't drift (see docs/inbox.md). */
export const inboxNavItem: NavItem = {
  href: "/inbox",
  label: "Inbox",
  icon: Inbox,
};

/** Settings, likewise shared — the sidebar footer's icon button and the "More" sheet row point at one href. */
export const settingsNavItem: NavItem = {
  href: "/settings/calendars",
  label: "Settings",
  icon: Settings,
};

/** Single source of truth for primary navigation — the sidebar renders all five. */
export const navItems: NavItem[] = [
  dashboard,
  calendar,
  content,
  journal,
  projects,
];

/**
 * The four destinations that get their own slot in the mobile tab bar. A tab
 * bar tops out at five slots before labels start wrapping and tap targets get
 * cramped (#114 — the bar carried nine), and the fifth is spent on "More", so
 * the least thumb-frequent of `navItems` (Projects & Meetings, which also has
 * by far the longest label) moves into the sheet instead.
 */
export const bottomNavItems: NavItem[] = [
  dashboard,
  calendar,
  content,
  journal,
];

/**
 * What the "More" sheet lists — every navigable destination that lost (or
 * never had) a bar slot, so all of them stay one tap from the bar. Search and
 * Sign out live in the sheet too, but they're actions rather than links, so
 * `MoreSheet` renders them itself.
 */
export const moreNavItems: NavItem[] = [
  projects,
  inboxNavItem,
  settingsNavItem,
];

/** Exact match for "/", prefix match otherwise, so nested routes (e.g. /calendar/2026-07-06) still highlight their section. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** True while the current route lives behind the "More" trigger, so the trigger can carry the active state its destinations can't. */
export function isMoreNavActive(pathname: string): boolean {
  return moreNavItems.some((item) => isNavItemActive(pathname, item.href));
}
