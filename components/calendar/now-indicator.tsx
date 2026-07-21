"use client";

import { isSameDay } from "date-fns";
import { useEffect, useState } from "react";

import { HOURS_IN_DAY } from "@/lib/calendar/constants";

interface NowIndicatorProps {
  day: Date;
  /** Server-rendered request time, used as the initial value so hydration matches exactly. */
  initialNow: Date;
}

/** Animated line marking the current time in a day/week time-grid column — only for today's column. */
export function NowIndicator({ day, initialNow }: NowIndicatorProps) {
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!isSameDay(now, day)) return null;

  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
  const topPercent = (minutesSinceMidnight / (HOURS_IN_DAY * 60)) * 100;

  return (
    <div
      aria-hidden
      data-testid="now-indicator"
      className="pointer-events-none absolute inset-x-0 z-10 flex items-center transition-[top] duration-motion-base ease-motion-standard"
      style={{ top: `${topPercent}%` }}
    >
      <span className="-ml-1 size-2 shrink-0 rounded-full bg-destructive" />
      <span className="h-px flex-1 bg-destructive" />
    </div>
  );
}
