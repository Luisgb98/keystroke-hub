"use client";

import { useActionState, useId, useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";

import { createMeetingNote } from "@/lib/meetings/actions";
import type { LinkableProjectOption } from "@/lib/data/improvements";
import {
  INITIAL_MEETING_TYPE,
  MEETING_TYPE_LABEL,
  MEETING_TYPES,
} from "@/lib/meetings/meeting-type";
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

interface MeetingNoteCaptureProps {
  projects: LinkableProjectOption[];
}

function emptyValues() {
  return {
    date: format(new Date(), "yyyy-MM-dd"),
    title: "",
    notes: "",
    meetingType: INITIAL_MEETING_TYPE as string,
    reflection: "",
    projectId: "",
  };
}

/**
 * Inline capture at the top of `/projects/meetings` — date, title, and
 * notes are the "enough to capture" set (see docs/meetings.md); type,
 * reflection, and the optional project link are revealed once the user
 * starts typing, same progressive-disclosure trigger as `ImprovementCapture`.
 */
export function MeetingNoteCapture({ projects }: MeetingNoteCaptureProps) {
  const titleId = useId();
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState(emptyValues);
  const [state, formAction, pending] = useActionState(
    createMeetingNote,
    undefined
  );

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) {
      setValues(emptyValues());
      setExpanded(false);
    }
  }

  const fieldErrors = state?.fieldErrors ?? {};

  function reveal() {
    if (!expanded) setExpanded(true);
  }

  return (
    <Card data-slot="meeting-note-capture">
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-col gap-2">
              <Label htmlFor="meeting-capture-date">Date</Label>
              <Input
                id="meeting-capture-date"
                type="date"
                name="date"
                value={values.date}
                onChange={(e) =>
                  setValues((v) => ({ ...v, date: e.target.value }))
                }
                className="w-auto"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor={titleId}>New meeting note</Label>
              <Input
                id={titleId}
                name="title"
                placeholder="What was the meeting?"
                value={values.title}
                onChange={(e) => {
                  setValues((v) => ({ ...v, title: e.target.value }));
                  reveal();
                }}
                aria-invalid={fieldErrors.title ? true : undefined}
              />
            </div>
          </div>
          {fieldErrors.title ? (
            <p role="alert" className="text-small text-destructive">
              {fieldErrors.title[0]}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="meeting-capture-notes">Notes</Label>
            <Textarea
              id="meeting-capture-notes"
              name="notes"
              placeholder="What was discussed?"
              value={values.notes}
              onChange={(e) => {
                setValues((v) => ({ ...v, notes: e.target.value }));
                reveal();
              }}
              aria-invalid={fieldErrors.notes ? true : undefined}
            />
            {fieldErrors.notes ? (
              <p role="alert" className="text-small text-destructive">
                {fieldErrors.notes[0]}
              </p>
            ) : null}
          </div>

          {expanded ? (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="meeting-capture-type">Type</Label>
                <Select
                  value={values.meetingType}
                  onValueChange={(value) =>
                    setValues((v) => ({
                      ...v,
                      meetingType: value ?? INITIAL_MEETING_TYPE,
                    }))
                  }
                >
                  <SelectTrigger id="meeting-capture-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEETING_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {MEETING_TYPE_LABEL[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="hidden"
                  name="meetingType"
                  value={values.meetingType}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="meeting-capture-reflection">
                  How did it go? (optional)
                </Label>
                <Textarea
                  id="meeting-capture-reflection"
                  name="reflection"
                  placeholder="Any quick reflection?"
                  value={values.reflection}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, reflection: e.target.value }))
                  }
                />
              </div>

              <input type="hidden" name="projectId" value={values.projectId} />
              {projects.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="meeting-capture-project">
                    Related project (optional)
                  </Label>
                  <Select
                    value={values.projectId || undefined}
                    onValueChange={(value) =>
                      setValues((v) => ({ ...v, projectId: value ?? "" }))
                    }
                  >
                    <SelectTrigger
                      id="meeting-capture-project"
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

          <Button type="submit" disabled={pending} className="self-start">
            <Plus aria-hidden />
            {pending ? "Saving…" : "Add"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
