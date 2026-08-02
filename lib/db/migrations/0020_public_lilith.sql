CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "game_id" uuid;--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN "game_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "games_name_lower_unique" ON "games" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ideas_game_id_idx" ON "ideas" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "streams_game_id_idx" ON "streams" USING btree ("game_id");