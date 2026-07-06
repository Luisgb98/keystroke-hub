"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { isNavItemActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  label: string;
  icon: ReactNode;
  variant: "sidebar" | "bottom";
}

export function NavLink({ href, label, icon, variant }: NavLinkProps) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, href);

  if (variant === "bottom") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-caption font-medium text-muted-foreground transition-colors duration-motion-fast ease-motion-standard",
          active && "text-foreground"
        )}
      >
        <span
          className={cn(
            "relative flex items-center justify-center rounded-lg px-3 py-1 transition-colors duration-motion-fast ease-motion-standard",
            active && "bg-secondary"
          )}
        >
          {icon}
          {active && (
            <span
              aria-hidden
              className="absolute -bottom-1 size-1 rounded-full bg-primary"
            />
          )}
        </span>
        <span className="text-center leading-tight text-balance">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-small font-medium text-muted-foreground transition-colors duration-motion-fast ease-motion-standard hover:bg-secondary hover:text-foreground",
        active &&
          "bg-secondary text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary before:content-['']"
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
