"use client";

import { useEffect, useState } from "react";

import { HOURS_IN_DAY } from "@/lib/calendar/constants";
import { appIsSameDay, appMinutesSinceMidnight } from "@/lib/time";

interface NowIndicatorProps {
  day: Date;
  /** Server-rendered request time, used as the initial value so hydration matches exactly. */
  initialNow: Date;
}

/**
 * Animated line marking the current time in a day/week time-grid column —
 * only for today's column.
 *
 * Both the day comparison and the vertical position are resolved in the app
 * timezone (see lib/time). That matters twice over: the server pass and the
 * hydration pass have to agree on the initial position, and the 60s tick
 * swaps the server-passed instant for a browser `new Date()` — which under
 * the old renderer-local reads would silently jump the line by the offset
 * between the browser and the server (issue #95).
 */
export function NowIndicator({ day, initialNow }: NowIndicatorProps) {
  const [now, setNow] = useState(initialNow);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!appIsSameDay(now, day)) return null;

  const topPercent = (appMinutesSinceMidnight(now) / (HOURS_IN_DAY * 60)) * 100;

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
