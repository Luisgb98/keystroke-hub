"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { ProjectSummary } from "@/lib/data/projects";

import { ProjectCard } from "./project-card";

interface ArchivedProjectsSectionProps {
  projects: ProjectSummary[];
}

/** Archived projects, collapsed by default — history survives but stays out of the way (see docs/projects.md). */
export function ArchivedProjectsSection({
  projects,
}: ArchivedProjectsSectionProps) {
  const [open, setOpen] = useState(false);

  if (projects.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-small font-semibold text-muted-foreground"
      >
        {open ? (
          <ChevronDown aria-hidden className="size-4" />
        ) : (
          <ChevronRight aria-hidden className="size-4" />
        )}
        Archived ({projects.length})
      </button>

      {open ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
