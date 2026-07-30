ALTER TABLE "ideas" ADD COLUMN "release_event_id" uuid;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "release_event_track" "track";--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_release_event_id_event_track_fk" FOREIGN KEY ("release_event_id","release_event_track") REFERENCES "public"."events"("id","track") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_release_event_id_unique" UNIQUE("release_event_id");--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_release_event_track_content" CHECK ("ideas"."release_event_track" is null or "ideas"."release_event_track" = 'content');