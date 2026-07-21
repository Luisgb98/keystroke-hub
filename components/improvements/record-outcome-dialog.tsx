"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { recordImprovementOutcome } from "@/lib/improvements/actions";
import type { ImprovementOutcomeStatus } from "@/lib/improvements/improvement-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RecordOutcomeDialogProps {
  improvementId: string;
  improvementTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DECISIONS: { status: ImprovementOutcomeStatus; label: string }[] = [
  { status: "accepted", label: "Accepted" },
  { status: "rejected", label: "Rejected" },
];

/**
 * Records the meeting verdict — decision + free-text outcome in one step,
 * the only path onto `accepted`/`rejected` (see docs/improvements.md).
 */
export function RecordOutcomeDialog({
  improvementId,
  improvementTitle,
  open,
  onOpenChange,
}: RecordOutcomeDialogProps) {
  const [decision, setDecision] = useState<ImprovementOutcomeStatus | null>(
    null
  );
  const [outcome, setOutcome] = useState("");
  const [pending, startTransition] = useTransition();

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setDecision(null);
      setOutcome("");
    }
  }

  function handleSubmit() {
    if (!decision) return;
    startTransition(async () => {
      const result = await recordImprovementOutcome(
        improvementId,
        decision,
        outcome
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`"${improvementTitle}" marked ${decision}`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record outcome</DialogTitle>
          <DialogDescription>{improvementTitle}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2" role="radiogroup" aria-label="Decision">
            {DECISIONS.map((item) => (
              <Button
                key={item.status}
                type="button"
                variant={decision === item.status ? "default" : "outline"}
                role="radio"
                aria-checked={decision === item.status}
                onClick={() => setDecision(item.status)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="record-outcome-text">Outcome (optional)</Label>
            <Textarea
              id="record-outcome-text"
              placeholder="What was decided?"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={!decision || pending}
            onClick={handleSubmit}
          >
            {pending ? "Saving…" : "Save outcome"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
