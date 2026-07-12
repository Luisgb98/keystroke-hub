import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProjectDetailHeader } from "@/components/projects/project-detail-header";
import { ProjectDetailsForm } from "@/components/projects/project-details-form";
import { ProjectImprovements } from "@/components/projects/project-improvements";
import { ProjectLinkedIdeas } from "@/components/projects/project-linked-ideas";
import { ProjectNotes } from "@/components/projects/project-notes";
import { getImprovementsForProject } from "@/lib/data/improvements";
import { getProject } from "@/lib/data/projects";

export const metadata: Metadata = {
  title: "Project",
};

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { id } = await params;
  const result = await getProject(id);
  if (!result) notFound();

  const { project, linkedIdeas } = result;
  const archived = Boolean(project.archivedAt);
  const improvements = await getImprovementsForProject(id);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:mx-auto sm:w-full sm:max-w-2xl sm:px-10 sm:py-8">
      <ProjectDetailHeader project={project} />

      <ProjectDetailsForm project={project} />

      <section className="flex flex-col gap-2">
        <h2 className="text-small font-semibold">Running notes</h2>
        <ProjectNotes
          projectId={project.id}
          notes={project.notes}
          disabled={archived}
        />
      </section>

      <ProjectLinkedIdeas
        projectId={project.id}
        linkedIdeas={linkedIdeas}
        disabled={archived}
      />

      <ProjectImprovements improvements={improvements} />
    </div>
  );
}
