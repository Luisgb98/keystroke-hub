import type { Track } from "./types";

/**
 * What kind of block an event reads as on the calendar (issue #104).
 *
 * Deliberately **not** the same thing as `Track`, the two-value Postgres enum
 * on `events`. The work/content split is a strict data-model boundary: it
 * decides which Google calendar an event syncs through, whether an idea may
 * link to it, and whether a meeting note may attach. A live stream is still
 * content work by that measure, so widening the enum would have dragged the
 * sync rules, the `idea_event_links` CHECK and the `streams` CHECK along with
 * it — and needed a backfill to make existing streams read as streams.
 *
 * So `stream` is *derived*: a content-track event is a Stream block exactly
 * when a `streams` row schedules it. Everything the issue asks for falls out
 * of that. Attaching an event to a stream turns its block purple and detaching
 * turns it back, with no calendar-side write at all; an inbound Google edit
 * can never change an event's kind, because it never touches the stream link;
 * and every stream that already existed reads as purple the moment this ships.
 */
export type TrackKind = "work" | "content" | "stream";

/** Display order — work first, then the two content-world kinds. */
export const TRACK_KINDS: TrackKind[] = ["work", "content", "stream"];

export function isTrackKind(value: unknown): value is TrackKind {
  return TRACK_KINDS.includes(value as TrackKind);
}

/** The kind a stored event reads as. Only a content-track event can be a stream. */
export function trackKindOf(event: {
  track: Track;
  streamId: string | null;
}): TrackKind {
  return event.track === "content" && event.streamId !== null
    ? "stream"
    : event.track;
}

/** The `events.track` value a chosen kind stores — a stream lives on the content track. */
export function trackForKind(kind: TrackKind): Track {
  return kind === "stream" ? "content" : kind;
}
