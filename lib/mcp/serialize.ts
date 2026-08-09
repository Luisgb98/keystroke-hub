import { formatAppDateParam, formatAppTimeParam } from "@/lib/time";

/**
 * How instants cross the MCP wire (issue #109).
 *
 * Every timestamp goes out twice: `*At` as an absolute ISO instant, and
 * `date`/`time` as the owner's wall clock in the app timezone. That pairing is
 * the #95 lesson made explicit — a client that wants to say "move this to the
 * same time next Friday" reads the wall clock and hands the same `date`/`time`
 * strings back, which is exactly the shape every write tool accepts. Nothing
 * ever re-parses an ISO instant as a wall-clock string or vice versa.
 */

export interface SerializedInstant {
  /** Absolute instant, e.g. "2026-08-01T17:00:00.000Z". */
  at: string;
  /** Wall clock in the app timezone, e.g. "2026-08-01". */
  date: string;
  /** Wall clock in the app timezone, e.g. "19:00". */
  time: string;
}

export function serializeInstant(value: Date): SerializedInstant {
  return {
    at: value.toISOString(),
    date: formatAppDateParam(value),
    time: formatAppTimeParam(value),
  };
}

export interface SerializedSlot {
  startsAt: SerializedInstant;
  endsAt: SerializedInstant;
  allDay: boolean;
}

export function serializeSlot(slot: {
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
}): SerializedSlot {
  return {
    startsAt: serializeInstant(slot.startsAt),
    endsAt: serializeInstant(slot.endsAt),
    allDay: slot.allDay,
  };
}
