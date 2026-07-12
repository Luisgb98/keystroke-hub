"use client";

import { useActionState, useState } from "react";

import { updateMeetingNoteDetails } from "@/lib/meetings/actions";
import type { MeetingNoteWithLinks } from "@/lib/data/meeting-notes";
import type { LinkableProjectOption } from "@/lib/data/improvements";
import {
  MEETING_TYPE_LABEL,
  MEETING_TYPES,
  type MeetingType,
} from "@/lib/meetings/meeting-type";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type NotesView = "write" | "preview";

interface MeetingNoteDetailsFormProps {
  meetingNote: MeetingNoteWithLinks;
  projects: LinkableProjectOption[];
}

/**
 * Date/title/type/notes/reflection/project — every editable field except
 * the linked event and improvements, which have their own attach/detach
 * sections on the detail page (see docs/meetings.md). Mirrors
 * `ProjectDetailsForm`'s always-visible, uncontrolled edit form, except the
 * type/project `Select`s need local state since they aren't native
 * `<select>`s (same pattern as `ImprovementCapture`).
 */
export function MeetingNoteDetailsForm({
  meetingNote,
  projects,
}: MeetingNoteDetailsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateMeetingNoteDetails,
    undefined
  );
  const [meetingType, setMeetingType] = useState<MeetingType>(
    meetingNote.meetingType
  );
  const [projectId, setProjectId] = useState(meetingNote.projectId ?? "");
  const [notes, setNotes] = useState(meetingNote.notes);
  const [notesView, setNotesView] = useState<NotesView>("write");
  const fieldErrors = state?.fieldErrors ?? {};

  function handleNotesViewChange(next: unknown) {
    setNotesView(next === "preview" ? "preview" : "write");
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={meetingNote.id} />
      <input type="hidden" name="meetingType" value={meetingType} />
      <input type="hidden" name="projectId" value={projectId} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-col gap-2">
          <Label htmlFor="meeting-detail-date">Date</Label>
          <Input
            id="meeting-detail-date"
            type="date"
            name="date"
            defaultValue={meetingNote.date}
            className="w-auto"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="meeting-detail-title">Title</Label>
          <Input
            id="meeting-detail-title"
            name="title"
            defaultValue={meetingNote.title}
            aria-invalid={fieldErrors.title ? true : undefined}
          />
          {fieldErrors.title ? (
            <p role="alert" className="text-small text-destructive">
              {fieldErrors.title[0]}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="meeting-detail-type">Type</Label>
        <Select
          value={meetingType}
          onValueChange={(value) =>
            setMeetingType((value as MeetingType) ?? meetingNote.meetingType)
          }
        >
          <SelectTrigger id="meeting-detail-type" className="w-full">
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
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="meeting-detail-notes">Notes</Label>
          <Tabs value={notesView} onValueChange={handleNotesViewChange}>
            <TabsList aria-label="Notes view">
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {notesView === "write" ? (
          <Textarea
            id="meeting-detail-notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-32"
            aria-invalid={fieldErrors.notes ? true : undefined}
          />
        ) : (
          <>
            <input type="hidden" name="notes" value={notes} />
            {notes.trim() ? (
              <div className="rounded-lg border border-border p-3">
                <MarkdownContent content={notes} />
              </div>
            ) : (
              <p className="text-small text-muted-foreground">
                Nothing written yet.
              </p>
            )}
          </>
        )}
        {fieldErrors.notes ? (
          <p role="alert" className="text-small text-destructive">
            {fieldErrors.notes[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="meeting-detail-reflection">How did it go?</Label>
        <Textarea
          id="meeting-detail-reflection"
          name="reflection"
          defaultValue={meetingNote.reflection ?? ""}
          placeholder="Any reflection on how it went?"
        />
      </div>

      {projects.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="meeting-detail-project">Related project</Label>
          <Select
            value={projectId || undefined}
            onValueChange={(value) => setProjectId(value ?? "")}
          >
            <SelectTrigger id="meeting-detail-project" className="w-full">
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

      {state?.error ? (
        <p role="alert" className="text-small text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        className="self-start"
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
