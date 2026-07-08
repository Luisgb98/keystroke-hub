/** Single source of truth for `lib/db/schema.ts`'s `idea_format` enum. */
export const IDEA_FORMATS = ["video", "stream", "either"] as const;

export type IdeaFormat = (typeof IDEA_FORMATS)[number];

export const INITIAL_IDEA_FORMAT: IdeaFormat = "either";

export const IDEA_FORMAT_LABEL: Record<IdeaFormat, string> = {
  video: "Video",
  stream: "Stream",
  either: "Either",
};

export function isIdeaFormat(value: unknown): value is IdeaFormat {
  return (
    typeof value === "string" &&
    (IDEA_FORMATS as readonly string[]).includes(value)
  );
}
