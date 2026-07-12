/**
 * The meeting-type vocabulary — single source of truth for
 * `lib/db/schema.ts`'s `meeting_type` enum and the meeting note form's type
 * select (see docs/meetings.md). `other` is the escape hatch, and the
 * default when a meeting doesn't fit the rest of the set.
 */
export const MEETING_TYPES = [
  "standup",
  "planning",
  "retro",
  "one_on_one",
  "review",
  "other",
] as const;

export type MeetingType = (typeof MEETING_TYPES)[number];

export const INITIAL_MEETING_TYPE: MeetingType = "other";

export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  standup: "Standup",
  planning: "Planning",
  retro: "Retro",
  one_on_one: "1:1",
  review: "Review",
  other: "Other",
};

export function isMeetingType(value: unknown): value is MeetingType {
  return (
    typeof value === "string" &&
    (MEETING_TYPES as readonly string[]).includes(value)
  );
}
