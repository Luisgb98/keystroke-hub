"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  dailyLogItems,
  dailyLogs,
  weeklyReviews,
  type DailyLogItem,
} from "@/lib/db/schema";
import {
  getDayLog,
  getOrCreateLog,
  nextItemPosition,
} from "@/lib/data/daily-logs";
import { getOrCreateWeeklyReview } from "@/lib/data/weekly-reviews";

import { shiftDateParam } from "./dates";
import {
  assessmentNoteSchema,
  highlightsSchema,
  itemTitleSchema,
  logDateSchema,
  moodSchema,
  retroSchema,
  weeklyRatingSchema,
} from "./log-schema";

export interface JournalActionResult {
  error?: string;
}

function revalidateJournalPaths(): void {
  revalidatePath("/journal");
  revalidatePath("/journal/standup");
  revalidatePath("/journal/week");
  revalidatePath("/journal/week/trend");
}

/** Appends a planned or ad-hoc-done item to the day's log, lazily creating the log row on first write (see docs/journal.md). */
export async function addItem(
  logDate: string,
  title: string,
  status: "planned" | "done" = "planned"
): Promise<JournalActionResult> {
  await verifySession();

  const parsedDate = logDateSchema.safeParse(logDate);
  if (!parsedDate.success) return { error: "That date isn't valid." };
  const parsedTitle = itemTitleSchema.safeParse(title);
  if (!parsedTitle.success) {
    return {
      error: parsedTitle.error.issues[0]?.message ?? "That title isn't valid.",
    };
  }

  const log = await getOrCreateLog(parsedDate.data);
  const position = await nextItemPosition(log.id);

  const db = getDb();
  await db.insert(dailyLogItems).values({
    logId: log.id,
    title: parsedTitle.data,
    status,
    completedAt: status === "done" ? new Date() : null,
    position,
  });

  revalidateJournalPaths();
  return {};
}

/** Title is the only field editable after capture (mirrors the stream/idea checklist precedent). */
export async function editItemTitle(
  itemId: string,
  title: string
): Promise<JournalActionResult> {
  await verifySession();

  const parsed = itemTitleSchema.safeParse(title);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "That title isn't valid.",
    };
  }

  const db = getDb();
  const updated = await db
    .update(dailyLogItems)
    .set({ title: parsed.data })
    .where(eq(dailyLogItems.id, itemId))
    .returning({ id: dailyLogItems.id });

  if (updated.length === 0) return { error: "That item no longer exists." };

  revalidateJournalPaths();
  return {};
}

/** planned <-> done; idempotent (mirrors `toggleChecklistItem`/`toggleIdeaChecklistItem`). Unchecking a done item reverses `completedAt`. */
export async function toggleItem(
  itemId: string,
  done: boolean
): Promise<JournalActionResult> {
  await verifySession();

  const db = getDb();
  const updated = await db
    .update(dailyLogItems)
    .set({
      status: done ? "done" : "planned",
      completedAt: done ? new Date() : null,
    })
    .where(eq(dailyLogItems.id, itemId))
    .returning({ id: dailyLogItems.id });

  if (updated.length === 0) return { error: "That item no longer exists." };

  revalidateJournalPaths();
  return {};
}

export async function deleteItem(itemId: string): Promise<JournalActionResult> {
  await verifySession();

  const db = getDb();
  await db.delete(dailyLogItems).where(eq(dailyLogItems.id, itemId));

  revalidateJournalPaths();
  return {};
}

/**
 * History-preserving rollover: copies the item onto the next calendar day
 * (lazily creating that day's log) as `planned`, and marks the source
 * `rolled_over` with `rolled_over_to_id` pointing at the copy — the original
 * stays visible, struck-through, rather than moving (see docs/journal.md).
 * The insert + source update go in one `db.batch()` call, the closest thing
 * to a transaction the neon-http driver offers (same precedent as
 * `createStream` in `lib/content/stream-actions.ts`).
 */
async function performRollover(
  item: DailyLogItem,
  fromLogDate: string
): Promise<void> {
  const db = getDb();
  const targetDate = shiftDateParam(fromLogDate, 1);
  const targetLog = await getOrCreateLog(targetDate);
  const position = await nextItemPosition(targetLog.id);
  const copyId = randomUUID();

  await db.batch([
    db.insert(dailyLogItems).values({
      id: copyId,
      logId: targetLog.id,
      title: item.title,
      status: "planned",
      position,
    }),
    db
      .update(dailyLogItems)
      .set({ status: "rolled_over", rolledOverToId: copyId })
      .where(eq(dailyLogItems.id, item.id)),
  ]);
}

export async function rolloverItem(
  itemId: string,
  fromLogDate: string
): Promise<JournalActionResult> {
  await verifySession();

  const db = getDb();
  const [item] = await db
    .select()
    .from(dailyLogItems)
    .where(eq(dailyLogItems.id, itemId));
  if (!item) return { error: "That item no longer exists." };
  if (item.status !== "planned") {
    return { error: "Only planned items can be rolled over." };
  }

  await performRollover(item, fromLogDate);

  revalidateJournalPaths();
  return {};
}

/** "Roll over all unfinished" — every still-`planned` item on the day, one rollover per item (see docs/journal.md). */
export async function rolloverAllUnfinished(
  logDate: string
): Promise<JournalActionResult> {
  await verifySession();

  const { log, items } = await getDayLog(logDate);
  if (!log) return {};

  const planned = items.filter((item) => item.status === "planned");
  for (const item of planned) {
    await performRollover(item, logDate);
  }

  if (planned.length > 0) revalidateJournalPaths();
  return {};
}

export async function saveRetro(
  logDate: string,
  retro: string
): Promise<JournalActionResult> {
  await verifySession();

  const parsed = retroSchema.safeParse({ logDate, retro });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "That note couldn't be saved.",
    };
  }

  const log = await getOrCreateLog(parsed.data.logDate);
  const value = parsed.data.retro.length > 0 ? parsed.data.retro : null;

  const db = getDb();
  await db
    .update(dailyLogs)
    .set({ retro: value })
    .where(eq(dailyLogs.id, log.id));

  revalidateJournalPaths();
  return {};
}

/** `mood: null` clears a previously-set mood. */
export async function saveMood(
  logDate: string,
  mood: number | null
): Promise<JournalActionResult> {
  await verifySession();

  const parsed = moodSchema.safeParse({ logDate, mood });
  if (!parsed.success) return { error: "That mood isn't valid." };

  const log = await getOrCreateLog(parsed.data.logDate);

  const db = getDb();
  await db
    .update(dailyLogs)
    .set({ mood: parsed.data.mood })
    .where(eq(dailyLogs.id, log.id));

  revalidateJournalPaths();
  return {};
}

/** The weekly summary's one piece of writable state — free text pulled out as the week's key items. */
export async function saveHighlights(
  weekStart: string,
  highlights: string
): Promise<JournalActionResult> {
  await verifySession();

  const parsed = highlightsSchema.safeParse({ weekStart, highlights });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Those highlights couldn't be saved.",
    };
  }

  const review = await getOrCreateWeeklyReview(parsed.data.weekStart);
  const value =
    parsed.data.highlights.length > 0 ? parsed.data.highlights : null;

  const db = getDb();
  await db
    .update(weeklyReviews)
    .set({ highlights: value })
    .where(eq(weeklyReviews.id, review.id));

  revalidateJournalPaths();
  return {};
}

/** The week's non-punitive self-rating. `rating: null` clears a previously-set rating — mirrors `saveMood`. */
export async function saveWeeklyRating(
  weekStart: string,
  rating: number | null
): Promise<JournalActionResult> {
  await verifySession();

  const parsed = weeklyRatingSchema.safeParse({ weekStart, rating });
  if (!parsed.success) return { error: "That rating isn't valid." };

  const review = await getOrCreateWeeklyReview(parsed.data.weekStart);

  const db = getDb();
  await db
    .update(weeklyReviews)
    .set({ rating: parsed.data.rating })
    .where(eq(weeklyReviews.id, review.id));

  revalidateJournalPaths();
  return {};
}

/** One of the three reflection prompts (went well / drained me / change next week) — free text, autosaved like `saveHighlights`. */
export async function saveAssessmentNote(
  weekStart: string,
  field: "wentWell" | "drainedMe" | "changeNext",
  value: string
): Promise<JournalActionResult> {
  await verifySession();

  const parsed = assessmentNoteSchema.safeParse({ weekStart, field, value });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "That note couldn't be saved.",
    };
  }

  const review = await getOrCreateWeeklyReview(parsed.data.weekStart);
  const nextValue = parsed.data.value.length > 0 ? parsed.data.value : null;

  const db = getDb();
  await db
    .update(weeklyReviews)
    .set({ [parsed.data.field]: nextValue })
    .where(eq(weeklyReviews.id, review.id));

  revalidateJournalPaths();
  return {};
}
