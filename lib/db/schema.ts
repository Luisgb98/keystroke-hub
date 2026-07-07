import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
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
      .defaultNow(),
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
