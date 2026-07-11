"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  currentWeekParam,
  formatWeekLabel,
  isCurrentWeekParam,
  shiftWeekParam,
} from "@/lib/journal/week-dates";
import { Button } from "@/components/ui/button";

interface WeekHeaderProps {
  weekStart: string;
}

/** Week label (JetBrains Mono accent), prev/next nav, "This week" shortcut (see docs/journal.md). */
export function WeekHeader({ weekStart }: WeekHeaderProps) {
  const router = useRouter();
  const isCurrent = isCurrentWeekParam(weekStart);

  function navigate(week: string) {
    router.push(`/journal/week?week=${week}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous week"
          onClick={() => navigate(shiftWeekParam(weekStart, -1))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next week"
          onClick={() => navigate(shiftWeekParam(weekStart, 1))}
        >
          <ChevronRight />
        </Button>
        {!isCurrent ? (
          <Button
            variant="outline"
            onClick={() => navigate(currentWeekParam())}
          >
            This week
          </Button>
        ) : null}
      </div>
      <span className="font-mono text-small text-muted-foreground">
        {formatWeekLabel(weekStart)}
      </span>
    </div>
  );
}
