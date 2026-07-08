CREATE TYPE "public"."idea_format" AS ENUM('video', 'stream', 'either');--> statement-breakpoint
CREATE TYPE "public"."idea_status" AS ENUM('spark', 'outlined', 'scripted', 'recorded', 'published', 'parked');--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"format" "idea_format" DEFAULT 'either' NOT NULL,
	"status" "idea_status" DEFAULT 'spark' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ideas_status_idx" ON "ideas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ideas_created_at_idx" ON "ideas" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ideas_tags_idx" ON "ideas" USING gin ("tags");