"use client";

import { useState, useTransition } from "react";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";

import { unarchiveProject } from "@/lib/projects/actions";
import type { Project } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ArchiveProjectDialog } from "./archive-project-dialog";
import { ProjectStatusSelect } from "./project-status-select";

interface ProjectDetailHeaderProps {
  project: Project;
}

/** Status quick-switch + archive/unarchive overflow action — mirrors `StreamDetailHeader`'s delete-dialog wiring, but archive instead of a hard delete (see docs/projects.md). */
export function ProjectDetailHeader({ project }: ProjectDetailHeaderProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const archived = Boolean(project.archivedAt);

  function handleUnarchive() {
    startTransition(async () => {
      const result = await unarchiveProject(project.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`"${project.name}" unarchived`);
    });
  }

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <ProjectStatusSelect
          projectId={project.id}
          status={project.status}
          disabled={archived}
        />
        {archived ? <Badge variant="outline">Archived</Badge> : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Project actions"
            >
              <MoreVertical aria-hidden className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {archived ? (
            <DropdownMenuItem disabled={pending} onClick={handleUnarchive}>
              Unarchive
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
              Archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ArchiveProjectDialog
        project={project}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
      />
    </div>
  );
}
