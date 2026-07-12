import type { Metadata } from "next";

import { ArchivedProjectsSection } from "@/components/projects/archived-projects-section";
import { ProjectCapture } from "@/components/projects/project-capture";
import { ProjectCard } from "@/components/projects/project-card";
import { listProjects, type ProjectsOverview } from "@/lib/data/projects";

export const metadata: Metadata = {
  title: "Projects & Meetings",
};

export default async function ProjectsPage() {
  // Renders even if the database is unreachable — same resilience contract
  // as /content/ideas and /content/streams (see docs/database.md).
  let overview: ProjectsOverview = { active: [], archived: [] };
  try {
    overview = await listProjects();
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
