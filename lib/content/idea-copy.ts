import type { Idea } from "@/lib/db/schema";

/**
 * Publishing metadata as ready-to-paste text blocks (#72). Each idea hands the
 * creator the exact four text blocks they assemble when publishing a video, so
 * publishing is copy-paste rather than retype.
 *
 * Tags render **comma-separated** (`speedrun, glitch`) everywhere — this matches
 * a video platform's tags field exactly, and unlike hashtag form it stays intact
 * for multi-word tags (`normalizeTags` only splits on commas, so a tag can carry
 * internal spaces — see docs/content-ideas.md).
 */

/** The four copyable blocks, in the order the card renders their buttons. */
export type IdeaCopyBlockKey =
  "title" | "title-tags" | "description-tags" | "tags";

export interface IdeaCopyBlock {
  key: IdeaCopyBlockKey;
  /** Button label, also the source of its accessible name. */
  label: string;
  /**
   * The exact text copied to the clipboard, or `null` when the idea carries
   * nothing for this block (no description, no tags) — the card renders the
   * button disabled rather than copying an empty string.
   */
  text: string | null;
}

/** Comma-separated tags, matching the platform tags field. */
export function formatIdeaTags(tags: readonly string[]): string {
  return tags.join(", ");
}

/** Joins present parts with a single blank line between them, dropping absent ones. */
function joinWithBlankLine(...parts: (string | null)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join("\n\n");
}

/**
 * Builds the idea's four publish blocks. `notes` is the description; the
 * author's line breaks are preserved verbatim (no reflowing). A block whose
 * source is empty resolves to `text: null` so the UI can disable it:
 * "Title + tags" and "Tags" need tags; "Description + tags" needs a
 * description (its tags are optional — the description is always copied
 * together with whatever tags exist).
 */
export function formatIdeaCopyBlocks(
  idea: Pick<Idea, "title" | "notes" | "tags">
): IdeaCopyBlock[] {
  const tagsText = idea.tags.length > 0 ? formatIdeaTags(idea.tags) : null;
  const description = idea.notes && idea.notes.length > 0 ? idea.notes : null;

  return [
    { key: "title", label: "Title", text: idea.title },
    {
      key: "title-tags",
      label: "Title + tags",
      text: tagsText ? joinWithBlankLine(idea.title, tagsText) : null,
    },
    {
      key: "description-tags",
      label: "Description + tags",
      text: description ? joinWithBlankLine(description, tagsText) : null,
    },
    { key: "tags", label: "Tags", text: tagsText },
  ];
}
