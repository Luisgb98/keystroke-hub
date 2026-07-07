import { FAKE_GOOGLE_BASE_URL } from "./credentials";

/** Configures the next `events.list` response the fake Google server returns. */
export async function setFakeGoogleEvents(items: unknown[]): Promise<void> {
  await fetch(`${FAKE_GOOGLE_BASE_URL}/__control/set-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items,
      nextSyncToken: `fake-sync-token-${Date.now()}`,
    }),
  });
}

/** Resets the fake Google server to its default empty response. */
export async function resetFakeGoogle(): Promise<void> {
  await fetch(`${FAKE_GOOGLE_BASE_URL}/__control/reset`, { method: "POST" });
}
