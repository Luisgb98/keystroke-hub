#!/usr/bin/env node
// One-off audit + repair for content-track events that span more than one day
// (issue #115).
//
// Streams and video releases are single-day by rule now — the editor mounts no
// end-date field for them, drag/resize clamps, and MCP has no `endDate`
// parameter. Rows created before that could still hold a multi-day span: the
// editor's own default was 23:00 → the next day's 00:00, so a stale default
// plus one careless save was enough. Expect zero to a handful; releases carry a
// fixed 1h span and streams a fixed 2h one, so anything found here was
// hand-edited or dragged.
//
// Usage:
//   pnpm fix:multi-day-content            # dry run — lists what would change
//   pnpm fix:multi-day-content --apply
//   pnpm fix:multi-day-content --revert=scripts/.single-day-fix-<stamp>.json
//
// The repair pulls `endsAt` back to 23:59 on the start's app-timezone day —
// the same clamp `lib/calendar/single-day.ts` applies to a resize, and
// deliberately not the next day's midnight, which reads as a different
// wall-clock day. `startsAt` is never touched, so nothing moves in the
// calendar; a too-long block just stops running into tomorrow.
//
// Unlike `fix-shifted-times.mts` this **is** idempotent: a second pass finds
// nothing, because every row it corrected now satisfies the rule.
//
// GOOGLE SYNC — corrected rows that are mirrored to Google are marked
// `pending_push`, so the next cron run patches Google with the shortened span
// (lib/sync/run.ts `retryPendingPushes`). That path records the new etag and
// `isOwnEcho` then skips the inbound reflection, so this cannot start an echo
// or conflict storm (see docs/google-sync.md).
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { readFileSync, writeFileSync } from "node:fs";

import { APP_TIMEZONE } from "../lib/time/app-timezone.ts";
import { formatInAppZone } from "../lib/time/index.ts";
import { clampToStartDay, isSingleAppDay } from "../lib/calendar/single-day.ts";

// Local dev setups vary between `.env` and `.env.local` (see .env.example);
// load both, without overriding whichever is already set.
config({ path: ".env.local" });
config({ path: ".env" });

// Connects directly rather than importing lib/db/index.ts, which is guarded
// by the `server-only` package and throws outside Next's server runtime.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill in " +
      "your Neon connection string."
  );
}
const db = drizzle(neon(connectionString));

const { events, eventSyncLinks } = await import("../lib/db/schema.ts");

interface BackupRow {
  id: string;
  title: string;
  endsAt: string;
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found?.slice(prefix.length);
}

function flag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

/** Wall clock in the app zone — the only zone in which "same day" means anything here. */
function wall(date: Date): string {
  return formatInAppZone(date, "yyyy-MM-dd HH:mm");
}

async function revert(path: string): Promise<void> {
  const rows: BackupRow[] = JSON.parse(readFileSync(path, "utf8"));
  console.log(`Reverting ${rows.length} event(s) from ${path}…`);
  for (const row of rows) {
    await db
      .update(events)
      .set({ endsAt: new Date(row.endsAt) })
      .where(eq(events.id, row.id));
  }
  console.log("✓ Reverted. Google-side rows are NOT reverted automatically.");
}

async function main(): Promise<void> {
  const revertPath = arg("revert");
  if (revertPath) return revert(revertPath);

  const apply = flag("apply");

  // Every content-track row, filtered in TypeScript rather than SQL: "same
  // app-timezone day" is a wall-clock question, and expressing it in Postgres
  // would hardcode the timezone into the query — the same reason this rule
  // isn't a CHECK constraint (see lib/calendar/single-day.ts).
  const rows = await db
    .select({ event: events, googleEventId: eventSyncLinks.googleEventId })
    .from(events)
    .leftJoin(eventSyncLinks, eq(eventSyncLinks.eventId, events.id))
    .where(eq(events.track, "content"));

  const offenders = rows.filter(
    ({ event }) => !isSingleAppDay(event.startsAt, event.endsAt)
  );

  console.log(`App timezone: ${APP_TIMEZONE}`);
  console.log(`Content-track events: ${rows.length}`);
  console.log(`Spanning more than one day: ${offenders.length}\n`);

  if (offenders.length === 0) {
    console.log("✓ Nothing to do — every content event already fits its day.");
    return;
  }

  const backup: BackupRow[] = [];
  for (const { event, googleEventId } of offenders) {
    const endsAt = clampToStartDay(event.startsAt, event.endsAt);
    backup.push({
      id: event.id,
      title: event.title,
      endsAt: event.endsAt.toISOString(),
    });
    console.log(
      `${apply ? "FIX " : "DRY "} ${event.title.slice(0, 36).padEnd(36)} ` +
        `${wall(event.startsAt)} → ${wall(event.endsAt)}  ` +
        `becomes → ${wall(endsAt)}` +
        `${googleEventId ? "  [synced]" : ""}`
    );
    if (!apply) continue;

    await db
      .update(events)
      .set({ endsAt, updatedAt: new Date() })
      .where(eq(events.id, event.id));
    // Queue the shortened span for Google; see the header note on echo safety.
    await db
      .update(eventSyncLinks)
      .set({ pushState: "pending_push" })
      .where(eq(eventSyncLinks.eventId, event.id));
  }

  if (!apply) {
    console.log(
      `\nDry run — nothing written. Re-run with --apply to correct ${offenders.length} event(s).`
    );
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `scripts/.single-day-fix-${stamp}.json`;
  writeFileSync(path, JSON.stringify(backup, null, 2));
  console.log(`\n✓ Corrected ${backup.length} event(s). Backup: ${path}`);
  console.log(
    "  Linked events are queued as pending_push — the next calendar-sync cron " +
      "run pushes the shortened spans to Google."
  );
}

await main();
