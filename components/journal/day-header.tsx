"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  formatDayLabel,
  isTodayParam,
  shiftDateParam,
  todayParam,
} from "@/lib/journal/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DayHeaderProps {
  logDate: string;
}

/** Date (JetBrains Mono accent), prev/next nav, "Today" shortcut, jump-to-date (see docs/journal.md). */
export function DayHeader({ logDate }: DayHeaderProps) {
  const router = useRouter();
  const isToday = isTodayParam(logDate);

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
        <Input
          type="date"
          aria-label="Jump to date"
          value={logDate}
          onChange={(e) => {
            if (e.target.value) navigate(e.target.value);
          }}
          className="w-auto"
        />
      </div>
    </div>
  );
}
