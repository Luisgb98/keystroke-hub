import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle2, NotebookText, Radio } from "lucide-react";

import type { StreamSummary } from "@/lib/data/streams";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface StreamCardProps {
  stream: StreamSummary;
}

/** List card for `/content/streams` — topic, date chip (or "Unscheduled"), checklist progress, and a retro-notes indicator. */
export function StreamCard({ stream }: StreamCardProps) {
  return (
    <Link
      href={`/content/streams/${stream.id}`}
      className="block"
      data-slot="stream-card"
    >
      <Card className="h-full border-track-content-border transition-colors hover:bg-track-content/40">
        <CardHeader className="flex flex-row items-center gap-2 text-caption text-muted-foreground">
          <Radio aria-hidden className="size-4 shrink-0" />
          <span className="font-mono">
            {stream.event
              ? stream.event.allDay
                ? format(stream.event.startsAt, "MMM d")
                : format(stream.event.startsAt, "MMM d, HH:mm")
              : "Unscheduled"}
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <h3 className="font-heading text-h3 font-semibold">{stream.title}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {stream.checklistTotal > 0 ? (
              <Badge variant="secondary" className="gap-1 font-mono">
                <CheckCircle2 aria-hidden className="size-3" />
                {stream.checklistDone}/{stream.checklistTotal}
              </Badge>
            ) : null}
            {stream.retroNotes ? (
              <Badge variant="outline" className="gap-1">
                <NotebookText aria-hidden className="size-3" />
                Notes
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
