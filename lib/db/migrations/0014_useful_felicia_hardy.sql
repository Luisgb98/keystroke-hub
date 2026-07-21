CREATE TYPE "public"."meeting_type" AS ENUM('standup', 'planning', 'retro', 'one_on_one', 'review', 'other');--> statement-breakpoint
CREATE TABLE "meeting_note_improvements" (
	"meeting_note_id" uuid NOT NULL,
	"improvement_id" uuid NOT NULL,
	CONSTRAINT "meeting_note_improvements_meeting_note_id_improvement_id_pk" PRIMARY KEY("meeting_note_id","improvement_id")
);
--> statement-breakpoint
CREATE TABLE "meeting_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"title" text NOT NULL,
	"meeting_type" "meeting_type" DEFAULT 'other' NOT NULL,
	"notes" text NOT NULL,
	"reflection" text,
	"project_id" uuid,
	"event_id" uuid,
	"event_track" "track",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_notes_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "meeting_notes_event_track_work" CHECK ("meeting_notes"."event_track" is null or "meeting_notes"."event_track" = 'work')
);
--> statement-breakpoint
ALTER TABLE "meeting_note_improvements" ADD CONSTRAINT "meeting_note_improvements_meeting_note_id_meeting_notes_id_fk" FOREIGN KEY ("meeting_note_id") REFERENCES "public"."meeting_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_note_improvements" ADD CONSTRAINT "meeting_note_improvements_improvement_id_improvements_id_fk" FOREIGN KEY ("improvement_id") REFERENCES "public"."improvements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_notes" ADD CONSTRAINT "meeting_notes_event_id_event_track_fk" FOREIGN KEY ("event_id","event_track") REFERENCES "public"."events"("id","track") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_notes_date_idx" ON "meeting_notes" USING btree ("date");--> statement-breakpoint
CREATE INDEX "meeting_notes_project_id_idx" ON "meeting_notes" USING btree ("project_id");