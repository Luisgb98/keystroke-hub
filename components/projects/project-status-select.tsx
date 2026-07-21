"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { updateProjectStatus } from "@/lib/projects/actions";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  type ProjectStatus,
} from "@/lib/projects/project-status";

interface ProjectStatusSelectProps {
  projectId: string;
  status: ProjectStatus;
  disabled?: boolean;
}

/** Inline status quick-switch — commits immediately, no confirmation, mirrors `IdeaCard`'s status select. */
export function ProjectStatusSelect({
  projectId,
  status,
  disabled = false,
}: ProjectStatusSelectProps) {
  const [pending, startTransition] = useTransition();

  function handleChange(next: string) {
    startTransition(async () => {
      const result = await updateProjectStatus(projectId, next);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <>
      <label className="sr-only" htmlFor={`project-status-${projectId}`}>
        Status
      </label>
      <select
        id={`project-status-${projectId}`}
        value={status}
        disabled={disabled || pending}
        onChange={(e) => handleChange(e.target.value)}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {PROJECT_STATUSES.map((option) => (
          <option key={option} value={option}>
            {PROJECT_STATUS_LABEL[option]}
          </option>
        ))}
      </select>
    </>
  );
}
