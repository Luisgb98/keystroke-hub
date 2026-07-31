/**
 * Size signals for a script the capture dialog is holding (#93). The dialog
 * caps the script field's height, so the text itself no longer tells you how
 * much landed — these do.
 */

/** Rough width of the collapsed field in characters — enough to tell a wrapped paragraph from a short line. */
const CHARS_PER_VISUAL_LINE = 48;

/** Visual lines the collapsed field can show; past this, "Expand" has something to reveal. */
export const SCRIPT_COLLAPSED_LINES = 6;

/**
 * Whitespace-separated runs, Markdown markup and all. Deliberately naive: this
 * answers "did my paste land?", it isn't an editorial word count.
 */
export function countScriptWords(content: string): number {
  const trimmed = content.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * The counter copy next to the Script label. Pinned to `en-US` grouping so a
 * five-figure paste reads as "12,480 words" regardless of the runtime locale.
 */
export function formatScriptSize(content: string): string {
  const words = countScriptWords(content);
  return `${words.toLocaleString("en-US")} ${words === 1 ? "word" : "words"}`;
}

/**
 * Approximates how tall the script renders, counting a long paragraph as the
 * several wrapped lines it actually occupies rather than the one `\n` it
 * contains. An estimate on purpose — it only decides whether to offer the
 * expand control, so being a line out either way costs nothing.
 */
export function estimateScriptVisualLines(content: string): number {
  if (content.length === 0) return 0;
  return content
    .split("\n")
    .reduce(
      (total, line) =>
        total + Math.max(1, Math.ceil(line.length / CHARS_PER_VISUAL_LINE)),
      0
    );
}

/** True once the script is taller than the collapsed field can show — the only time "Expand" does anything. */
export function scriptOverflowsCollapsed(content: string): boolean {
  return estimateScriptVisualLines(content) > SCRIPT_COLLAPSED_LINES;
}
