import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ArchivedProjectsSection } from "@/components/projects/archived-projects-section";
import { ProjectCapture } from "@/components/projects/project-capture";
import { ProjectCard } from "@/components/projects/project-card";
import { listProjects, type ProjectsOverview } from "@/lib/data/projects";
import { listImprovements } from "@/lib/data/improvements";

export const metadata: Metadata = {
  title: "Projects & Meetings",
};

export default async function ProjectsPage() {
  // Renders even if the database is unreachable — same resilience contract
  // as /content/ideas and /content/streams (see docs/database.md).
  let overview: ProjectsOverview = { active: [], archived: [] };
  let agendaCount = 0;
  try {
    const [projectsOverview, improvementsOverview] = await Promise.all([
      listProjects(),
      listImprovements(),
    ]);
    overview = projectsOverview;
    agendaCount = improvementsOverview.agenda.length;
  } catch (error) {
    console.error("Failed to load projects:", error);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">
          Projects & Meetings
        </h1>
        <p className="text-small text-muted-foreground">
          A home for each ongoing project — status, running notes, and
          everything linked to it.
        </p>
      </div>

      <Link
        href="/projects/improvements"
        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-small hover:bg-muted/50"
      >
        <span>
          Improvements backlog
          {agendaCount > 0
            ? ` — ${agendaCount} waiting for the next meeting`
            : ""}
        </span>
        <ArrowRight aria-hidden className="size-4 shrink-0" />
      </Link>

      <ProjectCapture />

      {overview.active.length === 0 ? (
        <p className="py-10 text-center text-small text-muted-foreground">
          No projects yet — add one above to get started.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {overview.active.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <ArchivedProjectsSection projects={overview.archived} />
    </div>
  );
}
