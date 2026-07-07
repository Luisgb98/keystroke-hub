CREATE TYPE "public"."connection_status" AS ENUM('active', 'error', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."push_state" AS ENUM('synced', 'pending_push', 'pending_delete', 'error');--> statement-breakpoint
CREATE TABLE "calendar_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track" "track" NOT NULL,
	"google_account_email" text NOT NULL,
	"google_calendar_id" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"sync_token" text,
	"channel_id" text,
	"channel_resource_id" text,
	"channel_expires_at" timestamp with time zone,
	"channel_token" text,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_connections_track_unique" UNIQUE("track")
);
--> statement-breakpoint
CREATE TABLE "event_sync_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"connection_id" uuid,
	"google_event_id" text NOT NULL,
	"google_etag" text,
	"google_updated_at" timestamp with time zone,
	"push_state" "push_state" DEFAULT 'synced' NOT NULL,
	"conflict_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_sync_links_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "event_sync_links" ADD CONSTRAINT "event_sync_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sync_links" ADD CONSTRAINT "event_sync_links_connection_id_calendar_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."calendar_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_sync_links_connection_id_idx" ON "event_sync_links" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "event_sync_links_google_event_id_idx" ON "event_sync_links" USING btree ("google_event_id");