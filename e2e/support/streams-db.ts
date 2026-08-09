import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { like } from "drizzle-orm";

import {
  events,
  streamChecklistTemplateItems,
  streams,
} from "../../lib/db/schema";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — streams e2e tests require it.");
  }
  return drizzle(neon(connectionString));
}

/** Removes every fixture stream row under a given title prefix — checklist items cascade with it. */
export async function clearTestStreams(prefix: string): Promise<void> {
  const db = getTestDb();
  await db.delete(streams).where(like(streams.title, `${prefix}%`));
}

/**
 * Seeds a stream that already has its slot on the calendar — an `events` row
 * on the content track plus the stream that owns it, exactly the shape
 * `createStream` produces (see docs/content-streams.md).
 *
 * The month review (#110) counts a stream as *held* from its linked event's
 * `starts_at`, so a stream with no event can't be placed in a month at all;
 * every dashboard fixture therefore has to go through here rather than
 * inserting a bare `streams` row. Deleting the stream leaves its event
 * behind, so callers pair this with `clearEventsWithPrefix`.
 */
export async function seedTestStream(fixture: {
  title: string;
  startsAt: Date;
  /** Defaults to an hour after `startsAt` — long enough to look like a real session. */
  endsAt?: Date;
  gameId?: string;
}): Promise<void> {
  const db = getTestDb();
  const [event] = await db
    .insert(events)
    .values({
      track: "content",
      title: fixture.title,
      startsAt: fixture.startsAt,
      endsAt:
        fixture.endsAt ?? new Date(fixture.startsAt.getTime() + 60 * 60 * 1000),
      allDay: false,
    })
    .returning({ id: events.id });

  await db.insert(streams).values({
    title: fixture.title,
    gameId: fixture.gameId ?? null,
    eventId: event.id,
    eventTrack: "content",
  });
}

/**
 * Seeds default-checklist template items directly, without driving the
 * template dialog. The template is a single global row set, so two spec files
 * editing it through the UI at once race each other — seeding here keeps
 * `stream-track.spec.ts` off the surface `streams.spec.ts` is exercising.
 */
export async function seedTemplateItems(labels: string[]): Promise<void> {
  if (labels.length === 0) return;
  const db = getTestDb();
  await db.insert(streamChecklistTemplateItems).values(
    labels.map((label, index) => ({
      label,
      // Well past anything the UI appends, so ordering can't collide with a
      // concurrently-running spec's own items.
      position: 1000 + index,
    }))
  );
}

/** Removes every fixture template item under a given label prefix — the template is global, so tests must clean up after themselves. */
export async function clearTestTemplateItems(prefix: string): Promise<void> {
  const db = getTestDb();
  await db
    .delete(streamChecklistTemplateItems)
    .where(like(streamChecklistTemplateItems.label, `${prefix}%`));
}
