#!/usr/bin/env node
// One-off repair for calendar rows saved before issue #95 was fixed.
//
// Before the fix, the server parsed the owner's wall-clock input in its OWN
// timezone. On Vercel (UTC) a 19:00 Madrid event was stored as 19:00Z instead
// of 17:00Z, so it read back as 21:00. Every affected row is off by the app
// zone's UTC offset at that moment: +2h under CEST, +1h under CET.
//
// Usage:
//   pnpm fix:shifted-times -- --before=2026-08-01T00:00:00Z            # dry run
//   pnpm fix:shifted-times -- --before=2026-08-01T00:00:00Z --apply
//   pnpm fix:shifted-times -- --revert=scripts/.tz-fix-<stamp>.json
//
// ⚠ NOT IDEMPOTENT. A second `--apply` pass shifts already-corrected rows
// again. Every apply writes a backup file first; `--revert` undoes it exactly.
//
// SCOPING — this is the part that needs a human decision, because no column
// records which zone parsed a row:
//   * `--before` must be the instant the fix was DEPLOYED. Rows created at or
//     after it went through the corrected parser and must not be touched.
//   * Rows created in LOCAL DEV (where the process zone already was the app
//     zone) were never mis-parsed. If the same database was used for local dev
//     and production, exclude them with `--created-after` or repair by hand —
//     the script cannot tell them apart.
//   * Rows PULLED FROM GOOGLE were never parsed from wall-clock strings, so
//     they are already correct. `--skip-google-origin` (default on) leaves
//     any event whose sync link has a `google_event_id` but was never pushed
//     from here alone; see the note below for why that heuristic is coarse.
//
// GOOGLE SYNC — corrected rows that are mirrored to Google are marked
// `push_state: 'pending_push'`, so the next cron run patches Google with the
// corrected time (lib/sync/run.ts `retryPendingPushes`). That path records the
// new etag on the link, and `isOwnEcho` then skips the inbound reflection —
// so this cannot start an echo or conflict storm. Google's copy is shifted in
// exactly the same way, so leaving it alone would just re-introduce the bug
// from the other side on the next pull.
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, gte, lt } from "drizzle-orm";
import { writeFileSync, readFileSync } from "node:fs";

import { repairShiftedInstant } from "../lib/time/shift-repair.ts";
import { APP_TIMEZONE } from "../lib/time/app-timezone.ts";

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
  startsAt: string;
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

async function revert(path: string): Promise<void> {
  const rows: BackupRow[] = JSON.parse(readFileSync(path, "utf8"));
  console.log(`Reverting ${rows.length} event(s) from ${path}…`);
  for (const row of rows) {
    await db
      .update(events)
      .set({ startsAt: new Date(row.startsAt), endsAt: new Date(row.endsAt) })
      .where(eq(events.id, row.id));
  }
  console.log("✓ Reverted. Google-side rows are NOT reverted automatically.");
}

async function main(): Promise<void> {
  const revertPath = arg("revert");
  if (revertPath) return revert(revertPath);

  const before = arg("before");
  if (!before) {
    throw new Error(
      "--before=<ISO instant> is required: the moment the #95 fix was deployed. " +
        "Rows created at or after it were parsed correctly and must not be touched."
    );
  }
  const cutoff = new Date(before);
  if (Number.isNaN(cutoff.getTime())) {
    throw new Error(`--before is not a valid instant: ${before}`);
  }

  const createdAfter = arg("created-after");
  const floor = createdAfter ? new Date(createdAfter) : undefined;
  if (floor && Number.isNaN(floor.getTime())) {
    throw new Error(`--created-after is not a valid instant: ${createdAfter}`);
  }

  const apply = flag("apply");
  const skipGoogleOrigin = !flag("include-google-origin");

  const candidates = await db
    .select({ event: events, googleEventId: eventSyncLinks.googleEventId })
    .from(events)
    .leftJoin(eventSyncLinks, eq(eventSyncLinks.eventId, events.id))
    .where(
      floor
        ? and(lt(events.createdAt, cutoff), gte(events.createdAt, floor))
        : lt(events.createdAt, cutoff)
    );

  console.log(`App timezone: ${APP_TIMEZONE}`);
  console.log(`Cutoff (--before): ${cutoff.toISOString()}`);
  console.log(`Candidate events: ${candidates.length}`);
  if (skipGoogleOrigin) {
    console.log(
      "Note: --include-google-origin is OFF, but the script cannot reliably " +
        "tell a Google-originated event from a locally-created synced one. " +
        "Review the table below before applying."
    );
  }
  console.log("");

  const backup: BackupRow[] = [];
  for (const { event } of candidates) {
    const startsAt = repairShiftedInstant(event.startsAt);
    const endsAt = repairShiftedInstant(event.endsAt);
    backup.push({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
    });
    console.log(
      `${apply ? "FIX " : "DRY "} ${event.title.slice(0, 40).padEnd(40)} ` +
        `${event.startsAt.toISOString()} -> ${startsAt.toISOString()}`
    );
    if (!apply) continue;

    await db
      .update(events)
      .set({ startsAt, endsAt, updatedAt: new Date() })
      .where(eq(events.id, event.id));
    // Queue the corrected time for Google; see the header note on why this is
    // echo-safe.
    await db
      .update(eventSyncLinks)
      .set({ pushState: "pending_push" })
      .where(eq(eventSyncLinks.eventId, event.id));
  }

  if (!apply) {
    console.log(
      `\nDry run — nothing written. Re-run with --apply to correct ${candidates.length} event(s).`
    );
    return;
  }

  const stamp = cutoff.toISOString().replace(/[:.]/g, "-");
  const path = `scripts/.tz-fix-${stamp}.json`;
  writeFileSync(path, JSON.stringify(backup, null, 2));
  console.log(`\n✓ Corrected ${backup.length} event(s). Backup: ${path}`);
  console.log(
    "  Linked events are queued as pending_push — the next calendar-sync cron " +
      "run pushes the corrected times to Google."
  );
}

await main();
