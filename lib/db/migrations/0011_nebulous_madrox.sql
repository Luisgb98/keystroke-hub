ALTER TABLE "weekly_reviews" ADD COLUMN "rating" smallint;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD COLUMN "went_well" text;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD COLUMN "drained_me" text;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD COLUMN "change_next" text;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_rating_range" CHECK ("weekly_reviews"."rating" is null or ("weekly_reviews"."rating" >= 1 and "weekly_reviews"."rating" <= 5));