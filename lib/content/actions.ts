"use server";

import { eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import {
  eventSyncLinks,
  events,
  ideaChecklistItems,
  ideaEventLinks,
  ideas,
  scripts,
} from "@/lib/db/schema";
import {
  pushEventCreated,
  pushEventDeleted,
  pushEventUpdated,
} from "@/lib/sync/push";

import {
  ideaCaptureSchema,
  ideaEditSchema,
  ideaStatusSchema,
  type ReleaseInput,
} from "./idea-schema";
import {
  DEFAULT_PUBLISH_CHECKLIST_ITEMS,
  isLateStage,
} from "./publish-checklist";
import { RELEASE_EVENT_TRACK, releaseEventTitle } from "./release";

export interface IdeaActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
}

const VALIDATION_ERROR = "Check the highlighted fields.";

type Db = ReturnType<typeof getDb>;

/**
 * Schedules `fn` via `after()`, swallowing a synchronous throw from `after`
 * itself — mirrors `lib/calendar/actions.ts`'s helper and the "push failures
 * never block or fail the mutation" contract in docs/google-sync.md.
 */
function schedulePush(fn: () => Promise<void>): void {
  try {
    after(fn);
  } catch (error) {
    console.error("Failed to schedule Google Calendar push:", error);
  }
}

/**
 * Creates the idea's managed release event (a content-track `events` row),
 * links it, and points the idea at it. The event is the source of truth for
 * the release date/time; the same push-after-commit contract as
 * `lib/calendar/actions.ts` means Google sync (#12) falls out for free (see
 * docs/content-ideas.md).
 */
async function createReleaseEvent(
  db: Db,
  ideaId: string,
  ideaTitle: string,
  release: ReleaseInput
): Promise<void> {
  const [event] = await db
    .insert(events)
    .values({
      track: RELEASE_EVENT_TRACK,
      title: releaseEventTitle(ideaTitle),
      startsAt: release.startsAt,
      endsAt: release.endsAt,
      allDay: false,
    })
    .returning({ id: events.id });

  await db.insert(ideaEventLinks).values({
    ideaId,
    eventId: event.id,
    eventTrack: RELEASE_EVENT_TRACK,
  });

  await db
    .update(ideas)
    .set({ releaseEventId: event.id, releaseEventTrack: RELEASE_EVENT_TRACK })
    .where(eq(ideas.id, ideaId));

  schedulePush(() => pushEventCreated(event.id, RELEASE_EVENT_TRACK));
}

/** Rewrites the release event's time span (and its title, kept in sync with the idea's). */
async function updateReleaseEvent(
  db: Db,
  eventId: string,
  ideaTitle: string,
  release: ReleaseInput
): Promise<void> {
  const updated = await db
    .update(events)
    .set({
      title: releaseEventTitle(ideaTitle),
      startsAt: release.startsAt,
      endsAt: release.endsAt,
    })
    .where(eq(events.id, eventId))
    .returning({ id: events.id, track: events.track });

  if (updated.length === 0) return;
  schedulePush(() => pushEventUpdated(updated[0].id, updated[0].track));
}

/**
 * Deletes the idea's release event, capturing its sync link first so the
 * Google-side delete survives the row (mirrors `deleteEvent` in
 * `lib/calendar/actions.ts`). The `ON DELETE SET NULL` FK nulls the idea's
 * pointer and the `ON DELETE CASCADE` link FK removes the join row on its own.
 */
async function deleteReleaseEvent(db: Db, eventId: string): Promise<void> {
  const [link] = await db
    .select()
    .from(eventSyncLinks)
    .where(eq(eventSyncLinks.eventId, eventId));

  const deleted = await db
    .delete(events)
    .where(eq(events.id, eventId))
    .returning({ id: events.id, track: events.track });

  if (deleted.length === 0) return;
  if (link) {
    schedulePush(() =>
      pushEventDeleted(link.id, link.googleEventId, deleted[0].track)
    );
  }
}

/**
 * Capture a new idea. Title is the only required field — everything else is
 * optional and can be filled in now or edited later (see docs/content-ideas.md).
 * An optional inline script and release date/time can be entered right here:
 * the release becomes a content-track calendar event owned by the idea, so it
 * shows up on the calendar immediately (issue #71).
 */
export async function createIdea(
  _prevState: IdeaActionState | undefined,
  formData: FormData
): Promise<IdeaActionState> {
  await verifySession();

  const parsed = ideaCaptureSchema.safeParse({
    title: formData.get("title") ?? "",
    notes: formData.get("notes") ?? "",
    format: formData.get("format") || undefined,
    tags: formData.get("tags") ?? "",
    script: formData.get("script") ?? "",
    releaseDate: formData.get("releaseDate") ?? "",
    releaseTime: formData.get("releaseTime") ?? "",
  });
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const { script, release, ...fields } = parsed.data;

  const db = getDb();
  // Neon's HTTP driver has no transactions, so these run sequentially, idea
  // first: a later failure (script or release) degrades to an unscheduled
  // idea rather than losing the capture — the same tolerance philosophy as
  // the publish-checklist seeding below.
  const [inserted] = await db
    .insert(ideas)
    .values(fields)
    .returning({ id: ideas.id });

  if (script) {
    await db.insert(scripts).values({ ideaId: inserted.id, content: script });
  }
  if (release) {
    await createReleaseEvent(db, inserted.id, fields.title, release);
  }

  revalidatePath("/content/ideas");
  revalidatePath("/content/board");
  if (release) revalidatePath("/calendar");
  return { success: true };
}

/**
 * Edit every field of an existing idea except the script (which keeps its own
 * dedicated editor page — see docs/scripts.md): title, notes, format, tags,
 * and the release date/time. Status/`stageEnteredAt` are owned by
 * `updateIdeaStatus` and left untouched here.
 *
 * The release transition is derived by comparing the desired release against
 * the idea's current `releaseEventId` (re-read from a trusted source, not the
 * client, per the server-actions data-security guide):
 * - none → set: create the managed event, link it, point the idea at it.
 * - set → changed: rewrite the event's time span (and title, if it changed).
 * - set → cleared: delete the event; the FKs unschedule the idea for us.
 */
export async function updateIdea(
  id: string,
  _prevState: IdeaActionState | undefined,
  formData: FormData
): Promise<IdeaActionState> {
  await verifySession();

  const parsed = ideaEditSchema.safeParse({
    title: formData.get("title") ?? "",
    notes: formData.get("notes") ?? "",
    format: formData.get("format") || undefined,
    tags: formData.get("tags") ?? "",
    releaseDate: formData.get("releaseDate") ?? "",
    releaseTime: formData.get("releaseTime") ?? "",
  });
  if (!parsed.success) {
    return {
      error: VALIDATION_ERROR,
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const { release, ...fields } = parsed.data;

  const db = getDb();
  const [existing] = await db
    .select({ id: ideas.id, releaseEventId: ideas.releaseEventId })
    .from(ideas)
    .where(eq(ideas.id, id));
  if (!existing) {
    return { error: "That idea no longer exists." };
  }

  await db.update(ideas).set(fields).where(eq(ideas.id, id));

  const currentEventId = existing.releaseEventId;
  let releaseChanged = false;
  if (release && !currentEventId) {
    await createReleaseEvent(db, id, fields.title, release);
    releaseChanged = true;
  } else if (release && currentEventId) {
    await updateReleaseEvent(db, currentEventId, fields.title, release);
    releaseChanged = true;
  } else if (!release && currentEventId) {
    await deleteReleaseEvent(db, currentEventId);
    releaseChanged = true;
  }

  revalidatePath("/content/ideas");
  revalidatePath("/content/board");
  if (releaseChanged) revalidatePath("/calendar");
  return { success: true };
}

export interface UpdateIdeaStatusResult {
  error?: string;
  /** Only set when the new status is `published` — powers the non-blocking publish nudge (see docs/content-ideas.md). */
  uncheckedCount?: number;
}

/**
 * Seeds the publish checklist's four defaults onto an idea, but only if it
 * has no checklist rows yet — "no rows" is the gate, not a `checklist_seeded_at`
 * marker, so a user who deletes every item and re-enters a late stage gets
 * them back (accepted tradeoff for a single-user app — see issue #20's plan).
 * Deliberately tolerant of the idea having vanished between the caller's own
 * status update and this call (e.g. deleted from another session in the
 * same instant) — that's an update that already succeeded on its own terms,
 * so a checklist that never gets seeded is a fine degrade, not worth failing
 * the whole request over.
 */
async function seedPublishChecklistIfMissing(
  db: Db,
  ideaId: string
): Promise<void> {
  try {
    const existingItems = await db
      .select({ id: ideaChecklistItems.id })
      .from(ideaChecklistItems)
      .where(eq(ideaChecklistItems.ideaId, ideaId));
    if (existingItems.length > 0) return;

    const seedValues = DEFAULT_PUBLISH_CHECKLIST_ITEMS.map(
      (label, position) => ({ ideaId, label, position })
    );
    await db.insert(ideaChecklistItems).values(seedValues);
  } catch (error) {
    console.error(
      `Failed to seed the publish checklist for idea ${ideaId}:`,
      error
    );
  }
}

/**
 * Shared by `IdeaCard`'s inline status control and #16's board move menu —
 * both surfaces call this one mutation, so behavior (including the stage
 * clock below) stays consistent between them. Mirrors `rescheduleEvent`'s
 * narrow-mutation shape in `lib/calendar/actions.ts`.
 *
 * `stageEnteredAt` resets to `now()` only when the status actually changes —
 * re-submitting the current status (e.g. re-selecting it, or a stale
 * optimistic retry) must not reset the board's time-in-stage clock (see
 * docs/content-ideas.md).
 *
 * Entering a late pipeline stage (`recorded`/`edited`/`published`) also
 * seeds the publish checklist's four defaults, but only the first time (see
 * `seedPublishChecklistIfMissing`) — run only once the status update itself
 * is confirmed to have hit a real row, so a deleted-idea request fails fast
 * without ever touching the checklist table.
 */
export async function updateIdeaStatus(
  id: string,
  status: string
): Promise<UpdateIdeaStatusResult> {
  await verifySession();

  const parsed = ideaStatusSchema.safeParse({ id, status });
  if (!parsed.success) {
    return { error: "That status isn't valid." };
  }

  const db = getDb();
  const updated = await db
    .update(ideas)
    .set({
      status: parsed.data.status,
      stageEnteredAt: sql`case when ${ideas.status} is distinct from ${parsed.data.status} then now() else ${ideas.stageEnteredAt} end`,
    })
    .where(eq(ideas.id, parsed.data.id))
    .returning({ id: ideas.id });

  if (updated.length === 0) {
    return { error: "That idea no longer exists." };
  }

  revalidatePath("/content/ideas");
  revalidatePath("/content/board");

  if (isLateStage(parsed.data.status)) {
    await seedPublishChecklistIfMissing(db, parsed.data.id);
  }

  if (parsed.data.status !== "published") {
    return {};
  }

  const checklistItems = await db
    .select({ done: ideaChecklistItems.done })
    .from(ideaChecklistItems)
    .where(eq(ideaChecklistItems.ideaId, parsed.data.id));

  return {
    uncheckedCount: checklistItems.filter((item) => !item.done).length,
  };
}

export interface DeleteIdeaResult {
  error?: string;
}

/**
 * Hard delete, no soft-archive — matches #11's event delete precedent (see
 * docs/content-ideas.md open question 5). The idea's managed release event is
 * a separate `events` row, so it's deleted explicitly here (the idea's own
 * cascade only reaches its scripts/checklist/links); other events the idea is
 * merely linked to are left alone.
 */
export async function deleteIdea(id: string): Promise<DeleteIdeaResult> {
  await verifySession();

  const db = getDb();
  const [existing] = await db
    .select({ releaseEventId: ideas.releaseEventId })
    .from(ideas)
    .where(eq(ideas.id, id));

  const deleted = await db
    .delete(ideas)
    .where(eq(ideas.id, id))
    .returning({ id: ideas.id });

  if (deleted.length === 0) {
    return { error: "That idea no longer exists." };
  }

  if (existing?.releaseEventId) {
    await deleteReleaseEvent(db, existing.releaseEventId);
    revalidatePath("/calendar");
  }
  revalidatePath("/content/ideas");
  revalidatePath("/content/board");
  return {};
}
