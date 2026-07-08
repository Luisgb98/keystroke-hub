import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Discriminated at the DB level: an event belongs to exactly one track,
// never both (see docs/calendar.md).
export const trackEnum = pgEnum("track", ["work", "content"]);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    track: trackEnum("track").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    // For all-day events, startsAt/endsAt are interpreted as date boundaries
    // rather than exact instants (see docs/calendar.md).
    allDay: boolean("all_day").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("events_starts_at_ends_at_idx").on(table.startsAt, table.endsAt),
    check(
      "events_ends_at_after_starts_at",
      sql`${table.endsAt} >= ${table.startsAt}`
    ),
  ]
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

// --- Google Calendar sync (issue #12) ---
//
// See docs/google-sync.md for the full design. Two tables: `calendarConnections`
// (one per track, at most) and `eventSyncLinks` (one per synced event, kept
// separate so #10/#11's `events` schema stays sync-agnostic and a disconnect
// is a clean deletion of connection state only).

export const connectionStatusEnum = pgEnum("connection_status", [
  "active",
  "error",
  "disconnected",
]);

export const pushStateEnum = pgEnum("push_state", [
  "synced",
  "pending_push",
  "pending_delete",
  "error",
]);

export const calendarConnections = pgTable(
  "calendar_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // At most one connection per track — the structural guarantee that
    // makes crossing tracks impossible (see docs/google-sync.md).
    track: trackEnum("track").notNull(),
    googleAccountEmail: text("google_account_email").notNull(),
    googleCalendarId: text("google_calendar_id").notNull(),
    // AES-256-GCM ciphertext (lib/google/crypto.ts) — never plaintext at rest.
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", {
      withTimezone: true,
    }).notNull(),
    syncToken: text("sync_token"),
    channelId: text("channel_id"),
    channelResourceId: text("channel_resource_id"),
    channelExpiresAt: timestamp("channel_expires_at", { withTimezone: true }),
    // Per-channel secret Google echoes back in `X-Goog-Channel-Token` on
    // every webhook push — verifies the request actually came from the
    // channel we created (lib/google/oauth.ts generates it at watch time).
    channelToken: text("channel_token"),
    status: connectionStatusEnum("status").notNull().default("active"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique("calendar_connections_track_unique").on(table.track)]
);

export const eventSyncLinks = pgTable(
  "event_sync_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable + "set null" on event delete (not cascade): deleting an event
    // marks this row `pending_delete` and clears `eventId` *before* the row
    // is removed, so the Google-side delete survives past the event's own
    // lifetime for the cron to push. Also nulled on disconnect (with
    // `connectionId` cleared instead) so a reconnect can re-link losslessly
    // by remembered `googleEventId` — see docs/google-sync.md open question 4.
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    connectionId: uuid("connection_id").references(
      () => calendarConnections.id,
      { onDelete: "set null" }
    ),
    // Nullable: a freshly-created local event whose very first outbound push
    // to Google failed has a link row (`push_state: "pending_push"`) before
    // it has ever been assigned a Google id — the cron retry inserts rather
    // than patches in that case (see lib/sync/run.ts).
    googleEventId: text("google_event_id"),
    googleEtag: text("google_etag"),
    googleUpdatedAt: timestamp("google_updated_at", { withTimezone: true }),
    pushState: pushStateEnum("push_state").notNull().default("synced"),
    conflictNote: text("conflict_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("event_sync_links_event_id_unique").on(table.eventId),
    index("event_sync_links_connection_id_idx").on(table.connectionId),
    index("event_sync_links_google_event_id_idx").on(table.googleEventId),
  ]
);

export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type NewCalendarConnection = typeof calendarConnections.$inferInsert;
export type EventSyncLink = typeof eventSyncLinks.$inferSelect;
export type NewEventSyncLink = typeof eventSyncLinks.$inferInsert;

// --- Idea capture & organization (issue #15) ---
//
// See docs/content-ideas.md. One table, deliberately independent of `events`
// — an idea only ever *becomes* content, it doesn't share the calendar's
// track discriminator (ideas live entirely in the content world).

export const ideaFormatEnum = pgEnum("idea_format", [
  "video",
  "stream",
  "either",
]);

// The full pipeline vocabulary is defined here (not just the initial stage)
// so issue #16's board consumes this single source of truth rather than
// inventing its own — see docs/content-ideas.md. Adding a stage later is a
// cheap `ALTER TYPE ... ADD VALUE` migration.
export const ideaStatusEnum = pgEnum("idea_status", [
  "spark",
  "outlined",
  "scripted",
  "recorded",
  "published",
  "parked",
]);

export const ideas = pgTable(
  "ideas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    notes: text("notes"),
    format: ideaFormatEnum("format").notNull().default("either"),
    status: ideaStatusEnum("status").notNull().default("spark"),
    // Free-form, single-user tags — filter options are derived from tags in
    // use rather than a normalized tag table (see docs/content-ideas.md).
    tags: text("tags").array().notNull().default([]),
    // Nullable, no UI yet: forward-compat for the projects tracker (#24),
    // which doesn't exist. Avoids a data migration once it lands.
    projectId: uuid("project_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ideas_status_idx").on(table.status),
    index("ideas_created_at_idx").on(table.createdAt),
    index("ideas_tags_idx").using("gin", table.tags),
  ]
);

export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;
