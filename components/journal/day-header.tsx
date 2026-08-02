"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  formatDayLabel,
  isTodayParam,
  shiftDateParam,
  todayParam,
} from "@/lib/journal/dates";
import { Button } from "@/components/ui/button";
import { DatePicker, parseDateValue } from "@/components/ui/date-picker";

interface DayHeaderProps {
  logDate: string;
}

/** Date (JetBrains Mono accent), prev/next nav, "Today" shortcut, jump-to-date (see docs/journal.md). */
export function DayHeader({ logDate }: DayHeaderProps) {
  const router = useRouter();
  const isToday = isTodayParam(logDate);

  // The field holds a draft so a date can be typed digit by digit; prev/next
  // and Today change `logDate` from the outside, which resets it.
  const [draft, setDraft] = useState(logDate);
  const [prevLogDate, setPrevLogDate] = useState(logDate);
  if (logDate !== prevLogDate) {
    setPrevLogDate(logDate);
    setDraft(logDate);
  }

  function navigate(date: string) {
    router.push(`/journal?date=${date}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous day"
          onClick={() => navigate(shiftDateParam(logDate, -1))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next day"
          onClick={() => navigate(shiftDateParam(logDate, 1))}
        >
          <ChevronRight />
        </Button>
        {!isToday ? (
          <Button variant="outline" onClick={() => navigate(todayParam())}>
            Today
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-small text-muted-foreground">
          {formatDayLabel(logDate)}
        </span>
        <DatePicker
          aria-label="Jump to date"
          triggerLabel="Open day calendar"
          value={draft}
          onChange={(next) => {
            setDraft(next);
            // Half-typed days ("2026-08-1") would otherwise push a route for
            // every keystroke; only a complete, real date navigates.
            if (parseDateValue(next)) navigate(next);
          }}
          className="w-40"
        />
      </div>
    </div>
  );
}
