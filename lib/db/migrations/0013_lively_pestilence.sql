CREATE TYPE "public"."improvement_status" AS ENUM('proposed', 'discussed', 'accepted', 'rejected', 'done');--> statement-breakpoint
CREATE TABLE "improvements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"rationale" text,
	"status" "improvement_status" DEFAULT 'proposed' NOT NULL,
	"outcome" text,
	"project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "improvements" ADD CONSTRAINT "improvements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "improvements_status_idx" ON "improvements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "improvements_project_id_idx" ON "improvements" USING btree ("project_id");