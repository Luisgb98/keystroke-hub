/**
 * The idea's release on the calendar (#71) is a content-track `events` row
 * owned by the idea (see docs/content-ideas.md). These constants define that
 * managed event's shape so `createIdea`/`updateIdea` and the tests agree on
 * one source of truth.
 */

/** Default release time when a date is chosen without one — the channel's standard publish slot. */
export const DEFAULT_RELEASE_TIME = "19:00";

/** A release is a point in the day, but the calendar has no zero-length events — give it a nominal block. */
export const RELEASE_EVENT_DURATION_MINUTES = 60;

/**
 * Title for the managed release event, derived from the idea so the calendar
 * reads clearly ("Release: Speedrun any% commentary"). Kept in sync whenever
 * the idea's title is edited.
 */
export function releaseEventTitle(ideaTitle: string): string {
  return `Release: ${ideaTitle}`;
}

/** The release event always lives on the content track and is never all-day. */
export const RELEASE_EVENT_TRACK = "content" as const;
