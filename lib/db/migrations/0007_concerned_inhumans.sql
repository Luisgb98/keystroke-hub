CREATE TABLE "stream_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stream_id" uuid NOT NULL,
	"label" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_checklist_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"retro_notes" text,
	"event_id" uuid,
	"event_track" "track",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "streams_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "streams_event_track_content" CHECK ("streams"."event_track" is null or "streams"."event_track" = 'content')
);
--> statement-breakpoint
ALTER TABLE "stream_checklist_items" ADD CONSTRAINT "stream_checklist_items_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_event_id_event_track_fk" FOREIGN KEY ("event_id","event_track") REFERENCES "public"."events"("id","track") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stream_checklist_items_stream_id_idx" ON "stream_checklist_items" USING btree ("stream_id");--> statement-breakpoint
CREATE INDEX "stream_checklist_template_items_position_idx" ON "stream_checklist_template_items" USING btree ("position");