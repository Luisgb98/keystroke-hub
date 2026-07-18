"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { discardEntry } from "@/lib/inbox/actions";
import {
  TRIAGE_DESTINATIONS,
  type TriageDestination,
} from "@/lib/inbox/entry-schema";
import { cn } from "@/lib/utils";
import { TRACK_SURFACE_CLASSES } from "@/components/calendar/track-styles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { DESTINATION_META } from "./destinations";
import { TriageDialog } from "./triage-dialog";

interface EntryCardProps {
  id: string;
  body: string;
  createdAt: Date;
  today: string;
}

/**
 * One untriaged thought: the raw text (read-only — editing happens in the
 * prefilled triage form, keeping the inbox dumb), a relative timestamp, a
 * Triage menu offering the four destinations, and a discard action. Whichever
 * action is chosen, the entry leaves the inbox on success (see docs/inbox.md).
 */
export function EntryCard({ id, body, createdAt, today }: EntryCardProps) {
  const [destination, setDestination] = useState<TriageDestination | null>(
    null
  );
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardPending, startDiscard] = useTransition();

  function handleDiscard() {
    startDiscard(async () => {
      const result = await discardEntry(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDiscardOpen(false);
      toast.success("Discarded");
    });
  }

  return (
    <Card data-slot="inbox-entry">
      <CardContent className="flex flex-col gap-3">
        <p className="text-small break-words whitespace-pre-wrap">{body}</p>
        <time
          dateTime={createdAt.toISOString()}
          suppressHydrationWarning
          className="font-mono text-caption text-muted-foreground"
        >
          {formatDistanceToNow(createdAt, { addSuffix: true })}
        </time>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="secondary" size="sm">
                  Triage
                  <ChevronDown aria-hidden />
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              {TRIAGE_DESTINATIONS.map((type) => {
                const meta = DESTINATION_META[type];
                const Icon = meta.icon;
                return (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => setDestination(type)}
                  >
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded border",
                        TRACK_SURFACE_CLASSES[meta.track]
                      )}
                    >
                      <Icon aria-hidden className="size-3" />
                    </span>
                    {meta.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDiscardOpen(true)}
            aria-label="Discard"
          >
            <Trash2 aria-hidden />
            Discard
          </Button>
        </div>
      </CardContent>

      {destination ? (
        <TriageDialog
          entryId={id}
          body={body}
          destination={destination}
          today={today}
          open={destination !== null}
          onOpenChange={(open) => {
            if (!open) setDestination(null);
          }}
          onTriaged={() => setDestination(null)}
        />
      ) : null}

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this thought?</AlertDialogTitle>
            <AlertDialogDescription>
              It leaves the inbox and won&apos;t become anything. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={discardPending}
              onClick={handleDiscard}
            >
              {discardPending ? "Discarding…" : "Discard"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
