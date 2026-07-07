import type { Track } from "@/lib/calendar/types";

/** The subset of `event_sync_links` the pure engine needs to make decisions. */
export interface SyncLinkRecord {
  id: string;
  eventId: string | null;
  googleEventId: string;
  googleEtag: string | null;
  /** When this link was last written by *our* side — the conflict-detection boundary. */
  updatedAt: Date;
}

/** The subset of `events` the pure engine needs. */
export interface LocalEventSnapshot {
  id: string;
  track: Track;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  updatedAt: Date;
}

export interface MappedEventInput {
  title: string;
  description: string | null;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
}

/** `remote` carries just enough of the Google event to persist on the sync link — see `lib/sync/engine.ts`. */
export interface RemoteStamp {
  googleEventId: string;
  googleEtag: string;
  googleUpdatedAt: Date;
}

export type SyncAction =
  | {
      type: "create-local";
      input: MappedEventInput;
      remote: RemoteStamp;
    }
  | {
      type: "update-local";
      eventId: string;
      input: MappedEventInput;
      remote: RemoteStamp;
    }
  | { type: "delete-local"; eventId: string }
  | { type: "skip-echo"; googleEventId: string }
  | {
      type: "conflict-remote-wins";
      eventId: string;
      input: MappedEventInput;
      remote: RemoteStamp;
      note: string;
    }
  | {
      type: "conflict-local-wins";
      eventId: string;
      googleEventId: string;
      note: string;
    };
