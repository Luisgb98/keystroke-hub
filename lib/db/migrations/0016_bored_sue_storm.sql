CREATE TYPE "public"."inbox_destination" AS ENUM('content_idea', 'improvement', 'daily_log_item', 'meeting_note', 'discarded');--> statement-breakpoint
CREATE TABLE "inbox_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"body" text NOT NULL,
	"triaged_at" timestamp with time zone,
	"triaged_to_type" "inbox_destination",
	"triaged_to_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "inbox_entries_triaged_at_created_at_idx" ON "inbox_entries" USING btree ("triaged_at","created_at");