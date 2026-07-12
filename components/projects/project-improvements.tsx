import Link from "next/link";

import type { ProjectImprovementSummary } from "@/lib/data/improvements";
import { ImprovementStatusBadge } from "@/components/improvements/improvement-status-badge";

interface ProjectImprovementsProps {
  improvements: ProjectImprovementSummary[];
}

/**
 * Read-only "linked" sibling section on the project detail page — the
 * second concrete linkable entity after `ProjectLinkedIdeas` (see
 * docs/projects.md). Editing (status, outcome, project link) happens on
 * `/projects/improvements`, not here — this is a summary with a way in.
 */
export function ProjectImprovements({
  improvements,
}: ProjectImprovementsProps) {
  return (
    <section
      data-slot="project-improvements"
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-small font-semibold">Improvements</h2>
        <Link
          href="/projects/improvements"
          className="text-caption text-muted-foreground hover:underline"
        >
          Open backlog
        </Link>
      </div>

      {improvements.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          No improvements linked yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {improvements.map((improvement) => (
            <li
              key={improvement.id}
              className="flex items-center gap-2 rounded-md bg-background/70 px-2 py-1.5"
            >
              <span className="flex-1 truncate text-small">
                {improvement.title}
              </span>
              <ImprovementStatusBadge status={improvement.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
