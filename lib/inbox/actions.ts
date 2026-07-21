"use server";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  dailyLogItems,
  ideas,
  improvements,
  inboxEntries,
  meetingNotes,
} from "@/lib/db/schema";
import { getOrCreateLog, nextItemPosition } from "@/lib/data/daily-logs";
import { todayParam } from "@/lib/journal/dates";

import { captureBodySchema, triagePayloadSchema } from "./entry-schema";

export interface CaptureActionState {
  error?: string;
  fieldError?: string;
  success?: boolean;
}

export interface InboxMutationResult {
  error?: string;
  success?: boolean;
  /** Where the entry went — lets the caller surface a "sent to Ideas" toast. */
  destinationId?: string;
}

/**
 * Revalidates every surface that shows the inbox or its count. `revalidatePath`
 * on the `(app)` layout refreshes the capture-dock/sidebar count badge across
 * every screen at once (the count is read in that layout — see docs/inbox.md),
 * while the explicit `/inbox` keeps the list itself fresh.
 */
function revalidateInboxSurfaces(): void {
  revalidatePath("/(app)", "layout");
  revalidatePath("/inbox");
  revalidatePath("/");
}

/**
 * Capture a thought. The body is the only input — no category, no title,
 * nothing else to decide (deferring classification is the whole point, see
 * docs/inbox.md). Whitespace-only bodies are rejected; everything else lands
 * in the inbox untriaged.
 */
export async function captureEntry(
  _prevState: CaptureActionState | undefined,
  formData: FormData
): Promise<CaptureActionState> {
  await verifySession();

  const parsed = captureBodySchema.safeParse(formData.get("body") ?? "");
  if (!parsed.success) {
    return { fieldError: parsed.error.issues[0]?.message ?? "Invalid entry." };
  }

  const db = getDb();
  await db.insert(inboxEntries).values({ body: parsed.data });

  revalidateInboxSurfaces();
  return { success: true };
}

/**
 * Convert an untriaged entry into a destination record and stamp it triaged
 * in one `db.batch()` — the closest thing the neon-http driver offers to a
 * transaction (it has no interactive `db.transaction()`, same constraint as
 * `createStream`). Batching both writes means an entry can never be duplicated
 * into a destination while remaining in the inbox, nor vanish from the inbox
 * without a destination record.
 *
 * Validation reuses the same field rules each destination's own capture
 * enforces (via `triagePayloadSchema`), so triage can't create a record the
 * destination itself would reject. Destination ids are generated here (not
 * left to `defaultRandom()`) so the created id can be recorded on the entry
 * *and* returned to the caller within the single batch.
 */
export async function triageEntry(
  entryId: string,
  payload: unknown
): Promise<InboxMutationResult> {
  await verifySession();

  const parsed = triagePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the fields." };
  }
  const data = parsed.data;

  const db = getDb();

  // Guard against triaging a missing or already-triaged entry — the update's
  // `isNull(triagedAt)` predicate is the belt-and-braces version for the
  // (single-user, unlikely) concurrent case.
  const [entry] = await db
    .select({ id: inboxEntries.id, triagedAt: inboxEntries.triagedAt })
    .from(inboxEntries)
    .where(eq(inboxEntries.id, entryId));
  if (!entry) return { error: "That entry no longer exists." };
  if (entry.triagedAt) return { error: "That entry was already triaged." };

  const destinationId = randomUUID();

  // daily-log items hang off the day's log row, lazily created on first write
  // (same `getOrCreateLog` semantics `addItem` established) — resolved before
  // the batch since the item insert needs the log id and next position.
  let destinationInsert;
  if (data.type === "content_idea") {
    destinationInsert = db.insert(ideas).values({
      id: destinationId,
      title: data.title,
      notes: data.notes && data.notes.length > 0 ? data.notes : null,
    });
  } else if (data.type === "improvement") {
    destinationInsert = db.insert(improvements).values({
      id: destinationId,
      title: data.title,
      rationale:
        data.rationale && data.rationale.length > 0 ? data.rationale : null,
    });
  } else if (data.type === "meeting_note") {
    destinationInsert = db.insert(meetingNotes).values({
      id: destinationId,
      date: data.date,
      title: data.title,
      notes: data.notes,
    });
  } else {
    // Triaged log items always land on *today's* log as `planned` — the
    // captured thought is a fresh to-do, not backdated (see docs/inbox.md).
    const log = await getOrCreateLog(todayParam());
    const position = await nextItemPosition(log.id);
    destinationInsert = db.insert(dailyLogItems).values({
      id: destinationId,
      logId: log.id,
      title: data.title,
      status: "planned",
      position,
    });
  }

  await db.batch([
    destinationInsert,
    db
      .update(inboxEntries)
      .set({
        triagedAt: new Date(),
        triagedToType: data.type,
        triagedToId: destinationId,
      })
      .where(and(eq(inboxEntries.id, entryId), isNull(inboxEntries.triagedAt))),
  ]);

  revalidateInboxSurfaces();
  revalidateTriageDestination(data.type);
  return { success: true, destinationId };
}

/** Revalidates the destination's own listing so the freshly-created record shows there. */
function revalidateTriageDestination(
  type: "content_idea" | "improvement" | "daily_log_item" | "meeting_note"
): void {
  switch (type) {
    case "content_idea":
      revalidatePath("/content/ideas");
      break;
    case "improvement":
      revalidatePath("/projects/improvements");
      break;
    case "daily_log_item":
      revalidatePath("/journal");
      revalidatePath("/journal/standup");
      break;
    case "meeting_note":
      revalidatePath("/projects/meetings");
      break;
  }
}

/**
 * Discard a junk thought. Like triage, this stamps `triaged_at` (so the entry
 * leaves the inbox by the same `IS NULL` filter) but records the outcome as
 * `discarded` with no destination — history-preserving rather than a delete
 * (see docs/inbox.md).
 */
export async function discardEntry(
  entryId: string
): Promise<InboxMutationResult> {
  await verifySession();

  const db = getDb();
  const updated = await db
    .update(inboxEntries)
    .set({ triagedAt: new Date(), triagedToType: "discarded" })
    .where(and(eq(inboxEntries.id, entryId), isNull(inboxEntries.triagedAt)))
    .returning({ id: inboxEntries.id });

  if (updated.length === 0) {
    return { error: "That entry was already gone." };
  }

  revalidateInboxSurfaces();
  return { success: true };
}
