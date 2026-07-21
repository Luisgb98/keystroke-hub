"use client";

import { useActionState, useId, useState } from "react";
import { Plus } from "lucide-react";

import { createProject } from "@/lib/projects/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_VALUES = { name: "", description: "" };

/**
 * Inline capture at the top of `/projects` — as frictionless as `IdeaCapture`
 * but rendered as a plain card in the flow, not a floating dialog: a project
 * is a rarer, more deliberate action than an idea or a stream (see
 * docs/projects.md). Name is the only required field.
 */
export function ProjectCapture() {
  const nameId = useId();
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState(EMPTY_VALUES);
  const [state, formAction, pending] = useActionState(createProject, undefined);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) {
      setValues(EMPTY_VALUES);
      setExpanded(false);
    }
  }

  const fieldErrors = state?.fieldErrors ?? {};

  return (
    <Card data-slot="project-capture">
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={nameId}>New project</Label>
            <div className="flex gap-2">
              <Input
                id={nameId}
                name="name"
                placeholder="Project name"
                value={values.name}
                onChange={(e) => {
                  setValues((v) => ({ ...v, name: e.target.value }));
                  if (!expanded) setExpanded(true);
                }}
                aria-invalid={fieldErrors.name ? true : undefined}
              />
              <Button type="submit" disabled={pending}>
                <Plus aria-hidden />
                {pending ? "Saving…" : "Add"}
              </Button>
            </div>
            {fieldErrors.name ? (
              <p role="alert" className="text-small text-destructive">
                {fieldErrors.name[0]}
              </p>
            ) : null}
          </div>

          {expanded ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-capture-description">
                Description (optional)
              </Label>
              <Textarea
                id="project-capture-description"
                name="description"
                placeholder="What is this?"
                value={values.description}
                onChange={(e) =>
                  setValues((v) => ({ ...v, description: e.target.value }))
                }
              />
            </div>
          ) : null}

          {state?.error ? (
            <p role="alert" className="text-small text-destructive">
              {state.error}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
