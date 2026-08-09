"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  currentMonthParam,
  formatMonthLabel,
  isCurrentMonthParam,
  shiftMonthParam,
} from "@/lib/dashboard/month-review";
import { Button } from "@/components/ui/button";

/**
 * Steps the month review back through past months (issue #110).
 *
 * The month lives in the URL (`/?month=YYYY-MM`), not in component state,
 * which is what makes the choice survive a reload without any storage: the
 * server component reads the same param back and re-renders the whole
 * section around it. Mirrors `WeekHeader` (`components/journal/week-header.tsx`).
 *
 * "Next" is disabled on the current month — there is no future to review,
 * and the server clamps a hand-typed future param to today's month anyway.
 */
export function MonthPicker({ month }: { month: string }) {
  const router = useRouter();
  const isCurrent = isCurrentMonthParam(month);

  function navigate(next: string) {
    router.push(`/?month=${next}`);
  }

  return (
    <div
      data-slot="month-picker"
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Month reviewed"
    >
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous month"
        onClick={() => navigate(shiftMonthParam(month, -1))}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next month"
        disabled={isCurrent}
        onClick={() => navigate(shiftMonthParam(month, 1))}
      >
        <ChevronRight />
      </Button>
      <span className="font-mono text-small text-muted-foreground">
        {formatMonthLabel(month)}
      </span>
      {!isCurrent ? (
        <Button variant="outline" onClick={() => navigate(currentMonthParam())}>
          This month
        </Button>
      ) : null}
    </div>
  );
}
