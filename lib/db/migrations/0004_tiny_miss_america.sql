ALTER TYPE "public"."idea_status" ADD VALUE 'edited' BEFORE 'published';--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "stage_entered_at" timestamp with time zone;--> statement-breakpoint
UPDATE "ideas" SET "stage_entered_at" = "updated_at";--> statement-breakpoint
ALTER TABLE "ideas" ALTER COLUMN "stage_entered_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "ideas" ALTER COLUMN "stage_entered_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "ideas_stage_entered_at_idx" ON "ideas" USING btree ("stage_entered_at");