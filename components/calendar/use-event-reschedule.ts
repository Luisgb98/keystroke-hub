"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { rescheduleEvent } from "@/lib/calendar/actions";
import { isNoopShift, type TimeShift } from "@/lib/calendar/drag";
import type { CalendarEvent } from "@/lib/calendar/types";

interface OptimisticOverride extends TimeShift {
  id: string;
}

export interface UseEventRescheduleResult {
  /** `events` with any in-flight reschedule already applied. */
  events: CalendarEvent[];
  /** Commits a drag/resize: optimistic update, persist, rollback + toast on failure. */
  reschedule: (event: CalendarEvent, shift: TimeShift) => void;
  /** True while a reschedule is in flight — new drags are held off until it settles. */
  isPending: boolean;
}

/**
 * Shared by every view (day/week/month): applies a drag/resize optimistically
 * via `rescheduleEvent`, reverting automatically if the mutation fails since
 * `useOptimistic` discards the pending override once the transition ends and
 * the base `events` prop hasn't moved. A quiet success toast offers Undo,
 * which is just calling `rescheduleEvent` again with the original bounds.
 */
export function useEventReschedule(
  events: CalendarEvent[]
): UseEventRescheduleResult {
  const [optimisticEvents, applyOptimistic] = useOptimistic(
    events,
    (state, override: OptimisticOverride) =>
      state.map((event) =>
        event.id === override.id
          ? { ...event, startsAt: override.startsAt, endsAt: override.endsAt }
          : event
      )
  );
  const [isPending, startTransition] = useTransition();

  function reschedule(event: CalendarEvent, shift: TimeShift) {
    if (isNoopShift(event, shift)) return;

    const previous: TimeShift = {
      startsAt: event.startsAt,
      endsAt: event.endsAt,
    };

    startTransition(async () => {
      applyOptimistic({ id: event.id, ...shift });
      const result = await rescheduleEvent(
        event.id,
        shift.startsAt,
        shift.endsAt
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast(`Moved "${event.title}"`, {
        action: {
          label: "Undo",
          onClick: () => reschedule({ ...event, ...shift }, previous),
        },
      });
    });
  }

  return { events: optimisticEvents, reschedule, isPending };
}
