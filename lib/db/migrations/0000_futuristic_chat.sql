CREATE TYPE "public"."track" AS ENUM('work', 'content');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track" "track" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_ends_at_after_starts_at" CHECK ("events"."ends_at" >= "events"."starts_at")
);
--> statement-breakpoint
CREATE INDEX "events_starts_at_ends_at_idx" ON "events" USING btree ("starts_at","ends_at");