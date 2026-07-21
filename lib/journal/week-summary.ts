import type { DailyLog, DailyLogItem } from "@/lib/db/schema";

import { formatDayLabel, formatShortDayLabel } from "./dates";
import { moodLabel } from "./mood";
import { buildWeekSignals, type WeekSignals } from "./signals";
import { formatWeekLabel } from "./week-dates";

export interface WeekDayInput {
  date: string;
  log: DailyLog | null;
  items: DailyLogItem[];
}

export interface WeekDaySummary {
  date: string;
  done: { id: string; title: string }[];
}

export interface WeekRetroSummary {
  date: string;
  retro: string;
  mood: number | null;
}

export interface CarriedOverItem {
  id: string;
  title: string;
  firstAppearedDate: string;
}

export interface WeekSummary {
  weekStart: string;
  doneByDay: WeekDaySummary[];
  retros: WeekRetroSummary[];
  carriedOver: CarriedOverItem[];
  highlights: string;
  isEmpty: boolean;
  // The weekly self-assessment (issue #23) — same lazily-created
  // `weekly_reviews` row as `highlights`, deliberately excluded from
  // `formatWeekSummaryMarkdown` below (see docs/journal.md): the export is
  // standup/reporting material for other people, the assessment is
  // self-reflection, and mixing them invites self-censorship.
  rating: number | null;
  wentWell: string;
  drainedMe: string;
  changeNext: string;
  signals: WeekSignals;
}

function byPosition(a: DailyLogItem, b: DailyLogItem): number {
  return a.position - b.position;
}

/**
 * Collapses rollover chains within the fetched week so a multi-day rollover
 * (Mon -> Tue -> Wed) is reported once, not once per hop. A chain's "root"
 * is the earliest copy visible in this week — no in-week item points to it,
 * though it may itself be a copy of something rolled over before the
 * fetched window, in which case it's still treated as first-appearing here.
 * Walking follows `rolledOverToId`; a chain that resolves to `done`
 * contributes nothing (the done copy already appears under its own day);
 * anything else — still `planned`, or `rolled_over` with a target outside
 * the fetched week or a deleted (null) target — counts as carried over,
 * attributed to the root's day.
 */
function collapseRolloverChains(days: WeekDayInput[]): CarriedOverItem[] {
  const dated = days.flatMap((day) =>
    day.items.map((item) => ({ item, date: day.date }))
  );
  const byId = new Map(dated.map((entry) => [entry.item.id, entry]));
  const targeted = new Set(
    dated
      .map((entry) => entry.item.rolledOverToId)
      .filter((id): id is string => id !== null)
  );

  const roots = dated
    .filter((entry) => !targeted.has(entry.item.id))
    .sort((a, b) => a.date.localeCompare(b.date) || byPosition(a.item, b.item));

  const carriedOver: CarriedOverItem[] = [];
  for (const root of roots) {
    let current = root;
    while (
      current.item.status === "rolled_over" &&
      current.item.rolledOverToId &&
      byId.has(current.item.rolledOverToId)
    ) {
      current = byId.get(current.item.rolledOverToId)!;
    }
    if (current.item.status !== "done") {
      carriedOver.push({
        id: root.item.id,
        title: root.item.title,
        firstAppearedDate: root.date,
      });
    }
  }

  return carriedOver;
}

export interface WeekReviewInput {
  highlights: string | null;
  rating: number | null;
  wentWell: string | null;
  drainedMe: string | null;
  changeNext: string | null;
}

/** Pure composition of a week's daily logs into the summary shape (see docs/journal.md). */
export function buildWeekSummary(
  weekStart: string,
  days: WeekDayInput[],
  review: WeekReviewInput | null
): WeekSummary {
  const doneByDay: WeekDaySummary[] = days.map((day) => ({
    date: day.date,
    done: day.items
      .filter((item) => item.status === "done")
      .sort(byPosition)
      .map((item) => ({ id: item.id, title: item.title })),
  }));

  const retros: WeekRetroSummary[] = days
    .filter((day) => day.log?.retro)
    .map((day) => ({
      date: day.date,
      retro: day.log!.retro!,
      mood: day.log!.mood,
    }));

  const carriedOver = collapseRolloverChains(days);
  const highlights = review?.highlights ?? "";
  const rating = review?.rating ?? null;
  const wentWell = review?.wentWell ?? "";
  const drainedMe = review?.drainedMe ?? "";
  const changeNext = review?.changeNext ?? "";

  const isEmpty =
    doneByDay.every((day) => day.done.length === 0) &&
    retros.length === 0 &&
    carriedOver.length === 0 &&
    highlights.trim().length === 0;

  const signals = buildWeekSignals(days, { doneByDay, carriedOver });

  return {
    weekStart,
    doneByDay,
    retros,
    carriedOver,
    highlights,
    isEmpty,
    rating,
    wentWell,
    drainedMe,
    changeNext,
    signals,
  };
}

function formatDoneSection(summary: WeekSummary): string {
  return summary.doneByDay
    .map((day) => {
      const heading = `### ${formatDayLabel(day.date)}`;
      if (day.done.length === 0) return `${heading}\n\n_Nothing logged._`;
      const items = day.done.map((item) => `- ${item.title}`).join("\n");
      return `${heading}\n\n${items}`;
    })
    .join("\n\n");
}

function formatRetroSection(summary: WeekSummary): string {
  if (summary.retros.length === 0) return "";
  const entries = summary.retros
    .map((retro) => {
      const mood = moodLabel(retro.mood);
      const heading = mood
        ? `**${formatDayLabel(retro.date)}** (${mood})`
        : `**${formatDayLabel(retro.date)}**`;
      return `${heading}\n${retro.retro}`;
    })
    .join("\n\n");
  return `## Retros\n\n${entries}`;
}

function formatCarriedOverSection(summary: WeekSummary): string {
  if (summary.carriedOver.length === 0) return "";
  const items = summary.carriedOver
    .map(
      (item) =>
        `- ${item.title} (since ${formatShortDayLabel(item.firstAppearedDate)})`
    )
    .join("\n");
  return `## Carried over\n\n${items}`;
}

/** Renders a `WeekSummary` as paste-friendly Markdown — highlights, done-by-day, retros, carried over (see docs/journal.md). */
export function formatWeekSummaryMarkdown(summary: WeekSummary): string {
  const sections = [
    `# Week of ${formatWeekLabel(summary.weekStart)}`,
    `## Highlights\n\n${summary.highlights.trim() || "_No highlights yet._"}`,
    `## Done\n\n${formatDoneSection(summary)}`,
    formatRetroSection(summary),
    formatCarriedOverSection(summary),
  ].filter((section) => section.length > 0);

  return sections.join("\n\n");
}
