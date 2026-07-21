CREATE TABLE "idea_event_links" (
	"idea_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"event_track" "track" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idea_event_links_idea_id_event_id_pk" PRIMARY KEY("idea_id","event_id"),
	CONSTRAINT "idea_event_links_event_track_content" CHECK ("idea_event_links"."event_track" = 'content')
);
--> statement-breakpoint
ALTER TABLE "idea_event_links" ADD CONSTRAINT "idea_event_links_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_id_track_unique" UNIQUE("id","track");--> statement-breakpoint
ALTER TABLE "idea_event_links" ADD CONSTRAINT "idea_event_links_event_id_event_track_fk" FOREIGN KEY ("event_id","event_track") REFERENCES "public"."events"("id","track") ON DELETE cascade ON UPDATE no action;