"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Briefcase } from "lucide-react";

import type { ImprovementSummary } from "@/lib/data/improvements";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { ImprovementStatusBadge } from "./improvement-status-badge";
import { ImprovementStatusSelect } from "./improvement-status-select";
import { RecordOutcomeDialog } from "./record-outcome-dialog";

interface ImprovementRowProps {
  improvement: ImprovementSummary;
}

const RESOLVED_STATUSES = new Set(["accepted", "rejected", "done"]);

/** List item for `/projects/improvements` — title, status, project chip, rationale snippet, and (once decided) the recorded outcome. */
export function ImprovementRow({ improvement }: ImprovementRowProps) {
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const resolved = RESOLVED_STATUSES.has(improvement.status);

  return (
    <Card data-slot="improvement-row">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ImprovementStatusBadge status={improvement.status} />
          {improvement.projectId ? (
            <Link
              href={`/projects/${improvement.projectId}`}
              className="flex items-center gap-1 text-caption text-muted-foreground hover:underline"
            >
              <Briefcase aria-hidden className="size-3.5 shrink-0" />
              {improvement.projectName}
            </Link>
          ) : null}
        </div>
        <span className="text-caption text-muted-foreground">
          Updated{" "}
          {formatDistanceToNow(improvement.updatedAt, { addSuffix: true })}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <h3 className="font-heading text-h3 font-semibold">
          {improvement.title}
        </h3>
        {improvement.rationale ? (
          <p className="line-clamp-2 text-small text-muted-foreground">
            {improvement.rationale}
          </p>
        ) : null}
        {improvement.outcome ? (
          <p className="text-small">
            <span className="font-semibold">Outcome: </span>
            {improvement.outcome}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <ImprovementStatusSelect
            improvementId={improvement.id}
            status={improvement.status}
          />
          {!resolved ? (
            <button
              type="button"
              onClick={() => setOutcomeOpen(true)}
              className="text-small text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Record outcome
            </button>
          ) : null}
        </div>
      </CardContent>

      <RecordOutcomeDialog
        improvementId={improvement.id}
        improvementTitle={improvement.title}
        open={outcomeOpen}
        onOpenChange={setOutcomeOpen}
      />
    </Card>
  );
}
