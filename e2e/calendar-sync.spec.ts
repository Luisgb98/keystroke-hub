import { expect, test } from "@playwright/test";

import { formatDateParam } from "../lib/calendar/range";
import {
  clearConnections,
  E2E_CONNECTION_EMAIL,
  seedConnection,
} from "./support/calendar-connections-db";
import { clearEventsWithPrefix } from "./support/events-db";
import { resetFakeGoogle, setFakeGoogleEvents } from "./support/fake-google";

// Shares the real dev database with other DB-backed specs — serialize this
// file's own tests so its seed/cleanup cycles don't race each other (see
// e2e/calendar.spec.ts for the same pattern against the same shared DB).
test.describe.configure({ mode: "serial" });

const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping calendar-sync DB-backed checks. Set " +
  "it locally (see .env.example) or on a Vercel preview to exercise this.";

const SYNCED_EVENT_PREFIX = "[e2e-sync]";
const SYNCED_EVENT_TITLE = `${SYNCED_EVENT_PREFIX} Standup`;

function todayIsoRange() {
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(10, 0, 0, 0);
  return { start, end };
}

test.describe("calendar sync settings", () => {
  test.skip(skip, skipReason);

  test.afterEach(async () => {
    await clearConnections();
    await clearEventsWithPrefix(SYNCED_EVENT_PREFIX);
    await resetFakeGoogle();
  });

  test("shows Connect for both tracks when nothing is connected", async ({
    page,
  }) => {
    await page.goto("/settings/calendars");

    await expect(page.getByText("No calendar connected")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Connect" })).toHaveCount(2);
  });

  test("reflects a connected track's status and account", async ({ page }) => {
    await seedConnection("work");

    await page.goto("/settings/calendars");

    await expect(page.getByText(E2E_CONNECTION_EMAIL)).toBeVisible();
    await expect(page.getByText("Connected", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sync now" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Disconnect" })
    ).toBeVisible();
  });

  test("Sync now pulls in a remote event onto the correct track's calendar", async ({
    page,
  }) => {
    await seedConnection("work");
    const { start, end } = todayIsoRange();
    await setFakeGoogleEvents([
      {
        id: "fake-remote-1",
        status: "confirmed",
        summary: SYNCED_EVENT_TITLE,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        updated: new Date().toISOString(),
        etag: '"fake-etag-1"',
      },
    ]);

    await page.goto("/settings/calendars");
    await page.getByRole("button", { name: "Sync now" }).click();
    await expect(page.getByText(/^Synced /)).toBeVisible();

    const todayParam = formatDateParam(new Date());
    await page.goto(`/calendar?view=day&date=${todayParam}`);
    await expect(page.getByText(SYNCED_EVENT_TITLE)).toBeVisible();
  });

  test("Disconnect removes the connection but leaves synced events on the calendar", async ({
    page,
  }) => {
    await seedConnection("content");
    const { start, end } = todayIsoRange();
    await setFakeGoogleEvents([
      {
        id: "fake-remote-2",
        status: "confirmed",
        summary: SYNCED_EVENT_TITLE,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        updated: new Date().toISOString(),
        etag: '"fake-etag-2"',
      },
    ]);

    await page.goto("/settings/calendars");
    await page.getByRole("button", { name: "Sync now" }).click();
    await expect(page.getByText(/^Synced /)).toBeVisible();

    await page.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByText(E2E_CONNECTION_EMAIL)).not.toBeVisible();
    await expect(page.getByText("No calendar connected")).toHaveCount(2);

    const todayParam = formatDateParam(new Date());
    await page.goto(`/calendar?view=day&date=${todayParam}`);
    await expect(page.getByText(SYNCED_EVENT_TITLE)).toBeVisible();
  });
});
