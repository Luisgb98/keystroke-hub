"use client";

import { useActionState, useEffect, useId, useState } from "react";
import Link from "next/link";
import { Clapperboard, ScrollText, X } from "lucide-react";
import { toast } from "sonner";

import { createIdea, updateIdea } from "@/lib/content/actions";
import {
  IDEA_FORMATS,
  INITIAL_IDEA_FORMAT,
  IDEA_FORMAT_LABEL,
  type IdeaFormat,
} from "@/lib/content/idea-format";
import {
  normalizeTags,
  PUBLISHING_TAG_STANDARD,
} from "@/lib/content/idea-schema";
import { DEFAULT_RELEASE_TIME } from "@/lib/content/release";
import type { Idea } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { IDEA_FORMAT_ICON } from "./idea-format-styles";

interface IdeaEditorProps {
  mode: "create" | "edit";
  /** Required in edit mode — the idea whose fields are being edited. */
  idea?: Idea;
  /** The idea's current release event start, if scheduled — prefills the date/time in edit mode. */
  releaseStartsAt?: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function dateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeParam(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

interface EditorValues {
  title: string;
  notes: string;
  format: IdeaFormat;
  tags: string;
  releaseDate: string;
  releaseTime: string;
  script: string;
}

function initialValues(
  mode: "create" | "edit",
  idea: Idea | undefined,
  releaseStartsAt: Date | null | undefined
): EditorValues {
  if (mode === "edit" && idea) {
    return {
      title: idea.title,
      notes: idea.notes ?? "",
      format: idea.format,
      tags: idea.tags.join(", "),
      releaseDate: releaseStartsAt ? dateParam(releaseStartsAt) : "",
      releaseTime: releaseStartsAt
        ? timeParam(releaseStartsAt)
        : DEFAULT_RELEASE_TIME,
      script: "",
    };
  }
  return {
    title: "",
    notes: "",
    format: INITIAL_IDEA_FORMAT,
    tags: "",
    releaseDate: "",
    releaseTime: DEFAULT_RELEASE_TIME,
    script: "",
  };
}

/**
 * Shared create/edit surface for an idea (issue #71). Mirrors `EventEditor`'s
 * `mode` prop and Dialog-for-both-viewports approach (see docs/calendar.md):
 * this project's shadcn setup has no drawer/sheet, and `DialogContent` is
 * responsive enough for a mobile-first, one-handed form. Capture allows an
 * inline Markdown script; editing links out to the dedicated script page.
 */
export function IdeaEditor({
  mode,
  idea,
  releaseStartsAt,
  open,
  onOpenChange,
}: IdeaEditorProps) {
  const titleId = useId();
  const action =
    mode === "edit" && idea ? updateIdea.bind(null, idea.id) : createIdea;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [values, setValues] = useState(() =>
    initialValues(mode, idea, releaseStartsAt)
  );
  const [capturedTitle, setCapturedTitle] = useState("");

  // Recompute field values on each open (the instance stays mounted, only
  // `open` toggles) and detect a successful submit — the same "adjust state
  // during render" pattern as EventEditor, avoiding an extra render pass.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setValues(initialValues(mode, idea, releaseStartsAt));
  }

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.success) {
      setCapturedTitle(values.title);
      onOpenChange(false);
    }
  }

  useEffect(() => {
    if (!state?.success) return;
    if (mode === "create") {
      toast.custom(() => (
        <div
          data-slot="idea-toast"
          className="flex items-center gap-2 rounded-lg border border-track-content-border bg-track-content px-3 py-2 text-sm text-track-content-foreground shadow-sm"
        >
          <Clapperboard aria-hidden className="size-4 shrink-0" />
          <span>
            Idea captured: <strong>{capturedTitle}</strong>
          </span>
        </div>
      ));
    } else {
      toast.success("Idea updated");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErrors = state?.fieldErrors ?? {};
  const tagCount = normalizeTags(values.tags).length;
  const tagsComplete = tagCount === PUBLISHING_TAG_STANDARD;
  const tagsOver = tagCount > PUBLISHING_TAG_STANDARD;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="format" value={values.format} />

          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "New idea" : "Edit idea"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Capture it now — everything but the title can wait."
                : "Update any field. Clearing the release date removes it from the calendar."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              name="title"
              autoFocus
              value={values.title}
              onChange={(e) =>
                setValues((v) => ({ ...v, title: e.target.value }))
              }
              aria-invalid={fieldErrors.title ? true : undefined}
            />
            {fieldErrors.title ? (
              <p role="alert" className="text-small text-destructive">
                {fieldErrors.title[0]}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Format</Label>
            <div
              role="radiogroup"
              aria-label="Format"
              className="grid grid-cols-3 gap-2"
            >
              {IDEA_FORMATS.map((format) => {
                const Icon = IDEA_FORMAT_ICON[format];
                const selected = values.format === format;
                return (
                  <button
                    key={format}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setValues((v) => ({ ...v, format }))}
                    className={cn(
                      "flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-all",
                      selected
                        ? "border-track-content-border bg-track-content text-track-content-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon aria-hidden className="size-4 shrink-0" />
                    {IDEA_FORMAT_LABEL[format]}
                  </button>
                );
              })}
            </div>
            {fieldErrors.format ? (
              <p role="alert" className="text-small text-destructive">
                {fieldErrors.format[0]}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="idea-notes">Notes</Label>
            <Textarea
              id="idea-notes"
              name="notes"
              value={values.notes}
              onChange={(e) =>
                setValues((v) => ({ ...v, notes: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="idea-tags">Tags</Label>
              <span
                data-slot="tag-counter"
                aria-live="polite"
                className={cn(
                  "font-mono text-caption",
                  tagsOver
                    ? "text-destructive"
                    : tagsComplete
                      ? "text-track-content-foreground"
                      : "text-muted-foreground"
                )}
              >
                {tagCount}/{PUBLISHING_TAG_STANDARD}
              </span>
            </div>
            <Input
              id="idea-tags"
              name="tags"
              placeholder="speedrun, tutorial, glitch"
              value={values.tags}
              onChange={(e) =>
                setValues((v) => ({ ...v, tags: e.target.value }))
              }
              aria-invalid={fieldErrors.tags ? true : undefined}
            />
            {fieldErrors.tags ? (
              <p role="alert" className="text-small text-destructive">
                {fieldErrors.tags[0]}
              </p>
            ) : (
              <p className="text-caption text-muted-foreground">
                {tagsComplete
                  ? "Comma-separated — five tags, the publishing standard."
                  : `Comma-separated. Aim for ${PUBLISHING_TAG_STANDARD} — this idea reads as incomplete until it has them.`}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="idea-release-date">Release date</Label>
              {values.releaseDate ? (
                <button
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, releaseDate: "" }))}
                  className="flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
                >
                  <X aria-hidden className="size-3.5" />
                  Clear
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                id="idea-release-date"
                name="releaseDate"
                type="date"
                value={values.releaseDate}
                onChange={(e) =>
                  setValues((v) => ({ ...v, releaseDate: e.target.value }))
                }
                aria-invalid={fieldErrors.releaseDate ? true : undefined}
              />
              <Input
                name="releaseTime"
                type="time"
                aria-label="Release time"
                disabled={!values.releaseDate}
                value={values.releaseTime}
                onChange={(e) =>
                  setValues((v) => ({ ...v, releaseTime: e.target.value }))
                }
                aria-invalid={fieldErrors.releaseTime ? true : undefined}
              />
            </div>
            {fieldErrors.releaseDate || fieldErrors.releaseTime ? (
              <p role="alert" className="text-small text-destructive">
                {(fieldErrors.releaseDate ?? fieldErrors.releaseTime)?.[0]}
              </p>
            ) : (
              <p className="text-caption text-muted-foreground">
                Sets when it publishes — shows on the content calendar. Defaults
                to {DEFAULT_RELEASE_TIME}.
              </p>
            )}
          </div>

          {mode === "create" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="idea-script">Script (optional)</Label>
              <Textarea
                id="idea-script"
                name="script"
                rows={4}
                placeholder="Write the Markdown script now, or add it later."
                value={values.script}
                onChange={(e) =>
                  setValues((v) => ({ ...v, script: e.target.value }))
                }
              />
            </div>
          ) : idea ? (
            <Button
              type="button"
              variant="outline"
              className="justify-start"
              render={<Link href={`/content/ideas/${idea.id}/script`} />}
            >
              <ScrollText aria-hidden className="size-4" />
              Edit script
            </Button>
          ) : null}

          {state?.error ? (
            <p role="alert" className="text-small text-destructive">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
