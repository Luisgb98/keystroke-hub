"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import {
  formatWeekSummaryMarkdown,
  type WeekSummary,
} from "@/lib/journal/week-summary";
import { Button } from "@/components/ui/button";

const CONFIRMATION_DELAY_MS = 2000;

interface CopySummaryButtonProps {
  summary: WeekSummary;
}

/** Copies the week as paste-friendly Markdown for pasting into a review doc (see docs/journal.md). */
export function CopySummaryButton({ summary }: CopySummaryButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatWeekSummaryMarkdown(summary));
      setCopied(true);
      toast.success("Copied the week's summary");
      setTimeout(() => setCopied(false), CONFIRMATION_DELAY_MS);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      Copy as Markdown
    </Button>
  );
}
