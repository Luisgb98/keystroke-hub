"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDateParam,
  formatRangeLabel,
  shiftDate,
} from "@/lib/calendar/range";
import type { CalendarView } from "@/lib/calendar/types";

interface CalendarHeaderProps {
  view: CalendarView;
  date: Date;
}

export function CalendarHeader({ view, date }: CalendarHeaderProps) {
  const router = useRouter();

  function navigate(nextView: CalendarView, nextDate: Date) {
    router.push(`/calendar?view=${nextView}&date=${formatDateParam(nextDate)}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-heading text-h2 font-semibold">
        {formatRangeLabel(view, date)}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous"
            onClick={() => navigate(view, shiftDate(view, date, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next"
            onClick={() => navigate(view, shiftDate(view, date, 1))}
          >
            <ChevronRight />
          </Button>
          <Button variant="outline" onClick={() => navigate(view, new Date())}>
            Today
          </Button>
        </div>

        <Tabs
          value={view}
          onValueChange={(value) => navigate(value as CalendarView, date)}
        >
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
