import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
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
    // Harmless alongside the PK — exists so `idea_event_links` (issue #18)
    // can carry a composite FK `(event_id, event_track) -> (id, track)`,
    // which is what makes a work-track link impossible at the DB level.
    unique("events_id_track_unique").on(table.id, table.track),
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
// cheap `ALTER TYPE ... ADD VALUE` migration. `edited` was added by #16,
// between `recorded` and `published`, to cover the board's pipeline.
export const ideaStatusEnum = pgEnum("idea_status", [
  "spark",
  "outlined",
  "scripted",
  "recorded",
  "edited",
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
    // Links an idea to its project (#24). `onDelete: "set null"` — there is
    // no delete action for projects (archive-only, see `projects` below), but
    // this keeps ideas safe even against a hypothetical future one. Was a
    // bare nullable uuid with no FK before #24 landed; every existing value
    // was NULL, so wiring up the FK needed no backfill.
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    // When the idea last entered its current `status` — powers the board's
    // (#16) time-in-stage chip and oldest-first column sort. Set by
    // `updateIdeaStatus` only when the status actually changes (re-selecting
    // the same status doesn't reset the clock). Backfilled from `updatedAt`
    // at migration time, since `updateIdeaStatus` was the only post-capture
    // write path before this column existed (see docs/content-ideas.md).
    stageEnteredAt: timestamp("stage_entered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    index("ideas_stage_entered_at_idx").on(table.stageEnteredAt),
    index("ideas_project_id_idx").on(table.projectId),
  ]
);

export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;

// --- Markdown script editor (issue #17) ---
//
// See docs/scripts.md. `unique(idea_id)` is what enforces "a script attaches
// to exactly one idea" at the schema level, and is the upsert's conflict
// target — the first save creates the row, every save after that updates it.

export const scripts = pgTable(
  "scripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique("scripts_idea_id_unique").on(table.ideaId)]
);

export type Script = typeof scripts.$inferSelect;
export type NewScript = typeof scripts.$inferInsert;

// --- Idea <-> calendar event links (issue #18) ---
//
// See docs/content-links.md. Many-to-many join table, content-track-only.
// The rule is enforced twice: `linkIdeaToEvent` (lib/content/link-actions.ts)
// rejects a non-content event before ever inserting, and — belt-and-braces —
// `eventTrack` is CHECK-constrained to `'content'` and FK'd against the
// composite `events_id_track_unique` above, so no code path can create (or
// leave behind, via a track flip) a work-track link.

export const ideaEventLinks = pgTable(
  "idea_event_links",
  {
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").notNull(),
    eventTrack: trackEnum("event_track").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.ideaId, table.eventId] }),
    foreignKey({
      columns: [table.eventId, table.eventTrack],
      foreignColumns: [events.id, events.track],
      name: "idea_event_links_event_id_event_track_fk",
    }).onDelete("cascade"),
    check(
      "idea_event_links_event_track_content",
      sql`${table.eventTrack} = 'content'`
    ),
  ]
);

export type IdeaEventLink = typeof ideaEventLinks.$inferSelect;
export type NewIdeaEventLink = typeof ideaEventLinks.$inferInsert;

// --- Stream session planner (issue #19) ---
//
// See docs/content-streams.md. A stream's "when" is its linked content-track
// calendar event — the row itself stores no date. `eventId`/`eventTrack` are
// nullable (an unscheduled stream has neither) with the same belt-and-braces
// composite-FK + CHECK pattern as `idea_event_links` above, except the CHECK
// also allows NULL (unscheduled). `onDelete: "set null"` on the composite FK
// means deleting the linked event unschedules the stream rather than
// destroying its checklist/notes; `unique(event_id)` keeps "one stream per
// event" true at the DB level.

export const streams = pgTable(
  "streams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    notes: text("notes"),
    retroNotes: text("retro_notes"),
    eventId: uuid("event_id"),
    eventTrack: trackEnum("event_track"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("streams_event_id_unique").on(table.eventId),
    foreignKey({
      columns: [table.eventId, table.eventTrack],
      foreignColumns: [events.id, events.track],
      name: "streams_event_id_event_track_fk",
    }).onDelete("set null"),
    check(
      "streams_event_track_content",
      sql`${table.eventTrack} is null or ${table.eventTrack} = 'content'`
    ),
  ]
);

export type Stream = typeof streams.$inferSelect;
export type NewStream = typeof streams.$inferInsert;

/**
 * Copy-on-create checklist rows: creating a stream snapshots
 * `streamChecklistTemplateItems` into these, so later template edits never
 * retroactively change an existing stream's checklist.
 */
export const streamChecklistItems = pgTable(
  "stream_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    streamId: uuid("stream_id")
      .notNull()
      .references(() => streams.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    done: boolean("done").notNull().default(false),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("stream_checklist_items_stream_id_idx").on(table.streamId)]
);

export type StreamChecklistItem = typeof streamChecklistItems.$inferSelect;
export type NewStreamChecklistItem = typeof streamChecklistItems.$inferInsert;

/** Single-user app: one global default checklist, no template "sets" (see docs/content-streams.md). */
export const streamChecklistTemplateItems = pgTable(
  "stream_checklist_template_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    label: text("label").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("stream_checklist_template_items_position_idx").on(table.position),
  ]
);

export type StreamChecklistTemplateItem =
  typeof streamChecklistTemplateItems.$inferSelect;
export type NewStreamChecklistTemplateItem =
  typeof streamChecklistTemplateItems.$inferInsert;

// --- Video publishing checklist (issue #20) ---
//
// See docs/content-ideas.md. Unlike the stream checklist, there is no
// template table: the four defaults (title, thumbnail, description, tags)
// are a code constant (`lib/content/publish-checklist.ts`), since a
// single-user app has no need for template management at this scope.
// `updateIdeaStatus` snapshots them onto an idea the first time it enters a
// late pipeline stage (`recorded`/`edited`/`published`) — "no rows yet" is
// the seeding gate, so later per-video edits (add/remove/toggle) are never
// retroactively touched by anything else.

export const ideaChecklistItems = pgTable(
  "idea_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ideaId: uuid("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    done: boolean("done").notNull().default(false),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("idea_checklist_items_idea_id_idx").on(table.ideaId)]
);

export type IdeaChecklistItem = typeof ideaChecklistItems.$inferSelect;
export type NewIdeaChecklistItem = typeof ideaChecklistItems.$inferInsert;

// --- Daily log with end-of-day retro & standup prep (issue #21) ---
//
// See docs/journal.md. `daily_logs` is created lazily on first write for a
// given day (no eager row per calendar day). `daily_log_items` holds both
// planned and done entries; rollover is a history-preserving copy (the
// source row flips to `rolled_over` and points at the copy via
// `rolled_over_to_id`) rather than a move, so a day's log never silently
// loses an entry.

export const dailyLogItemStatusEnum = pgEnum("daily_log_item_status", [
  "planned",
  "done",
  "rolled_over",
]);

export const dailyLogs = pgTable(
  "daily_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Plain `date` (civil day, no time component) — the work journal's unit
    // of account. Stored/read as a `yyyy-MM-dd` string throughout (see
    // lib/journal/dates.ts), matching the app's other date-param handling.
    logDate: date("log_date", { mode: "string" }).notNull(),
    retro: text("retro"),
    mood: smallint("mood"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("daily_logs_log_date_unique").on(table.logDate),
    check(
      "daily_logs_mood_range",
      sql`${table.mood} is null or (${table.mood} >= 1 and ${table.mood} <= 5)`
    ),
  ]
);

export type DailyLog = typeof dailyLogs.$inferSelect;
export type NewDailyLog = typeof dailyLogs.$inferInsert;

export const dailyLogItems = pgTable(
  "daily_log_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    logId: uuid("log_id")
      .notNull()
      .references(() => dailyLogs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: dailyLogItemStatusEnum("status").notNull().default("planned"),
    // Set only when this item was rolled over — points at its copy on the
    // target day's log. `onDelete: "set null"` so deleting the copy doesn't
    // take the (already-`rolled_over`) source down with it.
    rolledOverToId: uuid("rolled_over_to_id"),
    position: integer("position").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("daily_log_items_log_id_idx").on(table.logId),
    foreignKey({
      columns: [table.rolledOverToId],
      foreignColumns: [table.id],
      name: "daily_log_items_rolled_over_to_id_fk",
    }).onDelete("set null"),
  ]
);

export type DailyLogItem = typeof dailyLogItems.$inferSelect;
export type NewDailyLogItem = typeof dailyLogItems.$inferInsert;

// --- Weekly summary view (issue #22) ---
//
// Everything else in the weekly view is a read-side aggregation over
// daily_logs/daily_log_items; this table exists only for the one piece of
// writable state the week view adds. Created lazily on first highlights
// write, same pattern as daily_logs (see docs/journal.md).
//
// Issue #23 (weekly self-assessment) extends this same row rather than
// adding a second week-keyed table — `rating`/`wentWell`/`drainedMe`/
// `changeNext` are the non-punitive self-check-in fields, all nullable so
// any subset can be filled in independently of highlights. `rating` mirrors
// `daily_logs.mood`'s nullable-smallint-with-CHECK pattern exactly.

export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Always a Monday — enforced by normalizing in weekStartSchema before
    // write, not by a DB constraint (single-user app, one write path).
    weekStart: date("week_start", { mode: "string" }).notNull(),
    highlights: text("highlights"),
    rating: smallint("rating"),
    wentWell: text("went_well"),
    drainedMe: text("drained_me"),
    changeNext: text("change_next"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("weekly_reviews_week_start_unique").on(table.weekStart),
    check(
      "weekly_reviews_rating_range",
      sql`${table.rating} is null or (${table.rating} >= 1 and ${table.rating} <= 5)`
    ),
  ]
);

export type WeeklyReview = typeof weeklyReviews.$inferSelect;
export type NewWeeklyReview = typeof weeklyReviews.$inferInsert;

// --- Projects tracker (issue #24) ---
//
// See docs/projects.md. The connective tissue the rest of
// `epic:projects-meetings` points at — `ideas.projectId` above gets its real
// FK the moment this table exists.
//
// Archival is `archivedAt`, not a fourth status value: archival answers "is
// this visible in day-to-day lists?" while `status` answers "where did this
// end up?" — orthogonal questions, so a `done` project and a paused-then-
// abandoned project can both be archived without losing what their status
// was. Per the issue's acceptance criteria there is no delete action at
// all — archive is the only way off the active list, so linked history
// always survives.

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "paused",
  "done",
]);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    status: projectStatusEnum("status").notNull().default("active"),
    // Running notes, markdown — a single append/edit document rather than a
    // timeline of entries (see docs/projects.md open question 1).
    notes: text("notes").notNull().default(""),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("projects_status_idx").on(table.status),
    index("projects_archived_at_idx").on(table.archivedAt),
  ]
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

// --- Improvements & proposals backlog (issue #25) ---
//
// See docs/improvements.md. A running list of process/tooling ideas so
// retro and improvement meetings start with a ready agenda. The pipeline
// vocabulary (`proposed -> discussed -> accepted/rejected -> done`) is
// documented and shapes the UI, but not hard-enforced at the DB or action
// layer — single-user app, corrections should be cheap (same precedent as
// `projects`/`ideas` status changes).
//
// `projectId` is an optional nullable FK, same shape and `onDelete: "set
// null"` as `ideas.projectId` — an improvement belongs to at most one
// project. Unlike `ideas`, it's settable directly at capture time (see
// docs/improvements.md), not only via a separate attach flow.

export const improvementStatusEnum = pgEnum("improvement_status", [
  "proposed",
  "discussed",
  "accepted",
  "rejected",
  "done",
]);

export const improvements = pgTable(
  "improvements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    rationale: text("rationale"),
    status: improvementStatusEnum("status").notNull().default("proposed"),
    // What was decided, recorded alongside the accepted/rejected status
    // change (see `recordImprovementOutcome`). Kept even if the item is
    // later moved back to `proposed` — visible history, not cleared.
    outcome: text("outcome"),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("improvements_status_idx").on(table.status),
    index("improvements_project_id_idx").on(table.projectId),
  ]
);

export type Improvement = typeof improvements.$inferSelect;
export type NewImprovement = typeof improvements.$inferInsert;
