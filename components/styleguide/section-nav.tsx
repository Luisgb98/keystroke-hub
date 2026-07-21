import Link from "next/link";

import { styleguideSections } from "@/lib/tokens";

export function SectionNav() {
  return (
    <nav
      aria-label="Styleguide sections"
      className="sticky top-0 z-10 overflow-x-auto border-b bg-background/95 px-6 py-3 backdrop-blur sm:px-10"
    >
      <ul className="flex w-max min-w-full gap-4 text-small">
        {styleguideSections.map((section) => (
          <li key={section.id}>
            <Link
              href={`#${section.id}`}
              className="whitespace-nowrap text-muted-foreground transition-colors duration-motion-fast hover:text-foreground"
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
