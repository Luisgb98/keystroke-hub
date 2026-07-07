"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatDateParam,
  formatRangeLabel,
  shiftDate,
} from "@/lib/calendar/range";
import { quickAddFromNow } from "@/lib/calendar/quick-add";
import type { CalendarView } from "@/lib/calendar/types";

import { EventEditor } from "./event-editor";

interface CalendarHeaderProps {
  view: CalendarView;
  date: Date;
}

export function CalendarHeader({ view, date }: CalendarHeaderProps) {
  const router = useRouter();
  const [newEventOpen, setNewEventOpen] = useState(false);

  function navigate(nextView: CalendarView, nextDate: Date) {
    router.push(`/calendar?view=${nextView}&date=${formatDateParam(nextDate)}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-h2 font-semibold">
          {formatRangeLabel(view, date)}
        </h2>
        <Button onClick={() => setNewEventOpen(true)}>
          <Plus aria-hidden />
          New event
        </Button>
      </div>
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

      <EventEditor
        mode="create"
        defaults={quickAddFromNow(new Date())}
        open={newEventOpen}
        onOpenChange={setNewEventOpen}
      />
    </div>
  );
}
