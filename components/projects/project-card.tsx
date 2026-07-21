import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Lightbulb } from "lucide-react";

import type { ProjectSummary } from "@/lib/data/projects";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { ProjectStatusBadge } from "./project-status-badge";

interface ProjectCardProps {
  project: ProjectSummary;
}

/** List card for `/projects` — name, status, description snippet, linked-item count, last-updated. Track-agnostic: projects are connective tissue for both worlds, so no track color (see docs/projects.md). */
export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block"
      data-slot="project-card"
    >
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <ProjectStatusBadge status={project.status} />
          <span className="text-caption text-muted-foreground">
            Updated{" "}
            {formatDistanceToNow(project.updatedAt, { addSuffix: true })}
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <h3 className="font-heading text-h3 font-semibold">{project.name}</h3>
          {project.description ? (
            <p className="line-clamp-2 text-small text-muted-foreground">
              {project.description}
            </p>
          ) : null}
          {project.linkedIdeaCount > 0 ? (
            <Badge variant="secondary" className="w-fit gap-1 font-mono">
              <Lightbulb aria-hidden className="size-3" />
              {project.linkedIdeaCount}
            </Badge>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
