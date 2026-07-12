"use client";

import { useActionState, useId, useState } from "react";
import { Plus } from "lucide-react";

import { createImprovement } from "@/lib/improvements/actions";
import type { LinkableProjectOption } from "@/lib/data/improvements";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_VALUES = { title: "", rationale: "", projectId: "" };

interface ImprovementCaptureProps {
  projects: LinkableProjectOption[];
}

/**
 * Inline capture at the top of `/projects/improvements` — as frictionless as
 * `ProjectCapture`. Title is the only required field; rationale and the
 * optional project link live in the expanded view, not the first step (see
 * docs/improvements.md).
 */
export function ImprovementCapture({ projects }: ImprovementCaptureProps) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState(EMPTY_VALUES);
  const [state, formAction, pending] = useActionState(
    createImprovement,
    undefined
  );

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
    <Card data-slot="improvement-capture">
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={titleId}>New improvement</Label>
            <div className="flex gap-2">
              <Input
                id={titleId}
                name="title"
                placeholder="What should change?"
                value={values.title}
                onChange={(e) => {
                  setValues((v) => ({ ...v, title: e.target.value }));
                  if (!expanded) setExpanded(true);
                }}
                aria-invalid={fieldErrors.title ? true : undefined}
              />
              <Button type="submit" disabled={pending}>
                <Plus aria-hidden />
                {pending ? "Saving…" : "Add"}
              </Button>
            </div>
            {fieldErrors.title ? (
              <p role="alert" className="text-small text-destructive">
                {fieldErrors.title[0]}
              </p>
            ) : null}
          </div>

          {expanded ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="improvement-capture-rationale">
                  Rationale (optional)
                </Label>
                <Textarea
                  id="improvement-capture-rationale"
                  name="rationale"
                  placeholder="Why does this matter?"
                  value={values.rationale}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, rationale: e.target.value }))
                  }
                />
              </div>

              <input type="hidden" name="projectId" value={values.projectId} />

              {projects.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="improvement-capture-project">
                    Related project (optional)
                  </Label>
                  <Select
                    value={values.projectId || undefined}
                    onValueChange={(value) =>
                      setValues((v) => ({ ...v, projectId: value ?? "" }))
                    }
                  >
                    <SelectTrigger
                      id="improvement-capture-project"
                      className="w-full"
                    >
                      <SelectValue placeholder="No related project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </>
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
