CREATE TABLE "idea_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idea_id" uuid NOT NULL,
	"label" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idea_checklist_items" ADD CONSTRAINT "idea_checklist_items_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idea_checklist_items_idea_id_idx" ON "idea_checklist_items" USING btree ("idea_id");--> statement-breakpoint
-- Backfill: seed the four defaults for every idea already sitting in a late
-- pipeline stage, so existing ideas aren't missed by `updateIdeaStatus`'s
-- "first entry into a late stage" seeding trigger (see docs/content-ideas.md).
INSERT INTO "idea_checklist_items" ("idea_id", "label", "position")
SELECT i."id", d."label", d."position"
FROM "ideas" i
CROSS JOIN (VALUES ('Title', 0), ('Thumbnail', 1), ('Description', 2), ('Tags', 3)) AS d("label", "position")
WHERE i."status" IN ('recorded', 'edited', 'published');