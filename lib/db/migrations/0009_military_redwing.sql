CREATE TYPE "public"."daily_log_item_status" AS ENUM('planned', 'done', 'rolled_over');--> statement-breakpoint
CREATE TABLE "daily_log_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "daily_log_item_status" DEFAULT 'planned' NOT NULL,
	"rolled_over_to_id" uuid,
	"position" integer NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_date" date NOT NULL,
	"retro" text,
	"mood" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_logs_log_date_unique" UNIQUE("log_date"),
	CONSTRAINT "daily_logs_mood_range" CHECK ("daily_logs"."mood" is null or ("daily_logs"."mood" >= 1 and "daily_logs"."mood" <= 5))
);
--> statement-breakpoint
ALTER TABLE "daily_log_items" ADD CONSTRAINT "daily_log_items_log_id_daily_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_items" ADD CONSTRAINT "daily_log_items_rolled_over_to_id_fk" FOREIGN KEY ("rolled_over_to_id") REFERENCES "public"."daily_log_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_log_items_log_id_idx" ON "daily_log_items" USING btree ("log_id");