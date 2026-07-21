CREATE TYPE "public"."github_issue_state" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "github_issue_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"improvement_id" uuid,
	"meeting_note_id" uuid,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"issue_number" integer NOT NULL,
	"title" text,
	"state" "github_issue_state",
	"fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_issue_links_issue_number_positive" CHECK ("github_issue_links"."issue_number" > 0),
	CONSTRAINT "github_issue_links_exactly_one_target" CHECK (num_nonnulls("github_issue_links"."project_id", "github_issue_links"."improvement_id", "github_issue_links"."meeting_note_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "github_issue_links" ADD CONSTRAINT "github_issue_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_issue_links" ADD CONSTRAINT "github_issue_links_improvement_id_improvements_id_fk" FOREIGN KEY ("improvement_id") REFERENCES "public"."improvements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_issue_links" ADD CONSTRAINT "github_issue_links_meeting_note_id_meeting_notes_id_fk" FOREIGN KEY ("meeting_note_id") REFERENCES "public"."meeting_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_issue_links_project_unique" ON "github_issue_links" USING btree ("project_id","owner","repo","issue_number") WHERE "github_issue_links"."project_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "github_issue_links_improvement_unique" ON "github_issue_links" USING btree ("improvement_id","owner","repo","issue_number") WHERE "github_issue_links"."improvement_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "github_issue_links_meeting_note_unique" ON "github_issue_links" USING btree ("meeting_note_id","owner","repo","issue_number") WHERE "github_issue_links"."meeting_note_id" is not null;--> statement-breakpoint
CREATE INDEX "github_issue_links_project_id_idx" ON "github_issue_links" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "github_issue_links_improvement_id_idx" ON "github_issue_links" USING btree ("improvement_id");--> statement-breakpoint
CREATE INDEX "github_issue_links_meeting_note_id_idx" ON "github_issue_links" USING btree ("meeting_note_id");