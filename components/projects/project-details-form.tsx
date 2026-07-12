"use client";

import { useActionState, useId } from "react";

import { updateProjectDetails } from "@/lib/projects/actions";
import type { Project } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProjectDetailsFormProps {
  project: Project;
}

/** Name + description, editable any time — mutations besides "unarchive" are disabled once archived (see docs/projects.md). */
export function ProjectDetailsForm({ project }: ProjectDetailsFormProps) {
  const nameId = useId();
  const archived = Boolean(project.archivedAt);
  const [state, formAction, pending] = useActionState(
    updateProjectDetails,
    undefined
  );
  const fieldErrors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={project.id} />

      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>Name</Label>
        <Input
          id={nameId}
          name="name"
          defaultValue={project.name}
          disabled={archived}
          aria-invalid={fieldErrors.name ? true : undefined}
        />
        {fieldErrors.name ? (
          <p role="alert" className="text-small text-destructive">
            {fieldErrors.name[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="project-detail-description">Description</Label>
        <Textarea
          id="project-detail-description"
          name="description"
          defaultValue={project.description ?? ""}
          disabled={archived}
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-small text-destructive">
          {state.error}
        </p>
      ) : null}

      {!archived ? (
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={pending}
          className="self-start"
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      ) : null}
    </form>
  );
}
