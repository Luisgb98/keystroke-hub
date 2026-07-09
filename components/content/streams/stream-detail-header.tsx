"use client";

import { useState } from "react";
import { Radio, Trash2 } from "lucide-react";

import type { Stream } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";

import { DeleteStreamDialog } from "./delete-stream-dialog";

interface StreamDetailHeaderProps {
  stream: Stream;
}

/** Track identity + delete action for the stream detail page — mirrors `IdeaCard`'s delete-dialog wiring. */
export function StreamDetailHeader({ stream }: StreamDetailHeaderProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2 text-caption text-muted-foreground">
        <Radio aria-hidden className="size-4 shrink-0" />
        <span>Stream</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Delete "${stream.title}"`}
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 aria-hidden className="size-4" />
      </Button>

      <DeleteStreamDialog
        stream={stream}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
