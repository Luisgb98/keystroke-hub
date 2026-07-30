-- #70: collapse the idea pipeline to five stages (idea, scripted, recorded,
-- edited, published). Postgres can't DROP a value from an enum, so swap the
-- type via text — and while it's text, remap the retired statuses
-- (spark/outlined/parked) into `idea` so no existing row is lost.
ALTER TABLE "ideas" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "ideas" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
UPDATE "ideas" SET "status" = 'idea' WHERE "status" IN ('spark', 'outlined', 'parked');--> statement-breakpoint
DROP TYPE "public"."idea_status";--> statement-breakpoint
CREATE TYPE "public"."idea_status" AS ENUM('idea', 'scripted', 'recorded', 'edited', 'published');--> statement-breakpoint
ALTER TABLE "ideas" ALTER COLUMN "status" SET DATA TYPE "public"."idea_status" USING "status"::"public"."idea_status";--> statement-breakpoint
ALTER TABLE "ideas" ALTER COLUMN "status" SET DEFAULT 'idea';
