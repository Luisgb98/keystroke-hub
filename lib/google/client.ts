// Thin typed wrapper over the Google Calendar REST API — hand-rolled with
// `fetch` rather than the `googleapis`/`@googleapis/calendar` package (see
// docs/google-sync.md): the surface used is small, and defining it as an
// interface makes it trivially fakeable in unit tests without a mocking
// framework, matching how `lib/sync/engine.ts` is tested with plain fakes.
//
// `GOOGLE_CALENDAR_API_BASE_URL` overrides the base URL — real Google OAuth
// isn't automatable in CI/e2e, so e2e specs point this at a local fake
// server (see e2e/support/fake-google-server.ts) instead of intercepting
// requests, since these calls happen server-side and never touch the
// browser page Playwright can otherwise hook into.
const API_BASE =
  process.env.GOOGLE_CALENDAR_API_BASE_URL ??
  "https://www.googleapis.com/calendar/v3";

/** Google Calendar's event date, either an all-day `date` or a timed `dateTime` + zone. */
export interface GoogleEventDateTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

export interface GoogleEvent {
  id: string;
  status: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  updated: string;
  etag: string;
  recurringEventId?: string;
  originalStartTime?: GoogleEventDateTime;
}

export interface GoogleEventsPage {
  items: GoogleEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
}

export interface WatchChannelRequest {
  id: string;
  address: string;
  token: string;
  expirationMs: number;
}

export interface WatchChannelResult {
  resourceId: string;
  expiration: string;
}

/** Thrown when Google returns 410 GONE for an expired sync token — callers must fall back to a full re-list. */
export class SyncTokenExpiredError extends Error {
  constructor() {
    super("Google sync token expired (410) — a full resync is required.");
    this.name = "SyncTokenExpiredError";
  }
}

export interface ListEventsParams {
  syncToken?: string;
  timeMin?: string;
  timeMax?: string;
  pageToken?: string;
}

/** Everything the sync engine needs from Google, injectable for tests. */
export interface GoogleCalendarClient {
  listCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]>;
  listEvents(
    accessToken: string,
    calendarId: string,
    params: ListEventsParams
  ): Promise<GoogleEventsPage>;
  insertEvent(
    accessToken: string,
    calendarId: string,
    event: Partial<GoogleEvent>
  ): Promise<GoogleEvent>;
  patchEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    patch: Partial<GoogleEvent>
  ): Promise<GoogleEvent>;
  deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
  ): Promise<void>;
  watchEvents(
    accessToken: string,
    calendarId: string,
    channel: WatchChannelRequest
  ): Promise<WatchChannelResult>;
  stopChannel(
    accessToken: string,
    channelId: string,
    resourceId: string
  ): Promise<void>;
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function parseOrThrow(response: Response, context: string) {
  if (response.status === 410) throw new SyncTokenExpiredError();
  if (!response.ok) {
    throw new Error(
      `Google Calendar API error (${context}): ${response.status}`
    );
  }
  return response.status === 204 ? null : response.json();
}

/** The real client — talks to Google over `fetch`. */
export function createGoogleCalendarClient(): GoogleCalendarClient {
  return {
    async listCalendars(accessToken) {
      const response = await fetch(`${API_BASE}/users/me/calendarList`, {
        headers: authHeaders(accessToken),
      });
      const data = await parseOrThrow(response, "calendarList.list");
      return (data.items ?? []) as GoogleCalendarListEntry[];
    },

    async listEvents(accessToken, calendarId, params) {
      const query = new URLSearchParams();
      if (params.syncToken) query.set("syncToken", params.syncToken);
      if (params.timeMin) query.set("timeMin", params.timeMin);
      if (params.timeMax) query.set("timeMax", params.timeMax);
      if (params.pageToken) query.set("pageToken", params.pageToken);
      // syncToken and timeMin/timeMax are mutually exclusive per Google's API.
      query.set("singleEvents", "true");

      const response = await fetch(
        `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`,
        { headers: authHeaders(accessToken) }
      );
      const data = await parseOrThrow(response, "events.list");
      return {
        items: (data.items ?? []) as GoogleEvent[],
        nextPageToken: data.nextPageToken,
        nextSyncToken: data.nextSyncToken,
      };
    },

    async insertEvent(accessToken, calendarId, event) {
      const response = await fetch(
        `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: "POST",
          headers: authHeaders(accessToken),
          body: JSON.stringify(event),
        }
      );
      return (await parseOrThrow(response, "events.insert")) as GoogleEvent;
    },

    async patchEvent(accessToken, calendarId, eventId, patch) {
      const response = await fetch(
        `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: "PATCH",
          headers: authHeaders(accessToken),
          body: JSON.stringify(patch),
        }
      );
      return (await parseOrThrow(response, "events.patch")) as GoogleEvent;
    },

    async deleteEvent(accessToken, calendarId, eventId) {
      const response = await fetch(
        `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE", headers: authHeaders(accessToken) }
      );
      // Google returns 410 for an already-deleted event — treat as success.
      if (!response.ok && response.status !== 410 && response.status !== 404) {
        throw new Error(
          `Google Calendar API error (events.delete): ${response.status}`
        );
      }
    },

    async watchEvents(accessToken, calendarId, channel) {
      const response = await fetch(
        `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
        {
          method: "POST",
          headers: authHeaders(accessToken),
          body: JSON.stringify({
            id: channel.id,
            type: "web_hook",
            address: channel.address,
            token: channel.token,
            expiration: String(channel.expirationMs),
          }),
        }
      );
      const data = await parseOrThrow(response, "events.watch");
      return { resourceId: data.resourceId, expiration: data.expiration };
    },

    async stopChannel(accessToken, channelId, resourceId) {
      const response = await fetch(`${API_BASE}/channels/stop`, {
        method: "POST",
        headers: authHeaders(accessToken),
        body: JSON.stringify({ id: channelId, resourceId }),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(
          `Google Calendar API error (channels.stop): ${response.status}`
        );
      }
    },
  };
}
