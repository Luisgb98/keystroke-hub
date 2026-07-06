import {
  Briefcase,
  CalendarDays,
  Clapperboard,
  LayoutDashboard,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Single source of truth for primary navigation — consumed by both the sidebar and the bottom tab bar. */
export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/content", label: "Content", icon: Clapperboard },
  { href: "/journal", label: "Journal", icon: NotebookPen },
  { href: "/projects", label: "Projects & Meetings", icon: Briefcase },
];

/** Exact match for "/", prefix match otherwise, so nested routes (e.g. /calendar/2026-07-06) still highlight their section. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
