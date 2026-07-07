import { devices, expect, test } from "@playwright/test";

import { formatDateParam } from "../lib/calendar/range";
import {
  clearEventsWithPrefix,
  deleteTestEventByTitle,
  getTestEventTimes,
  insertTestEvent,
} from "./support/events-db";

// Own prefix (not the shared `[e2e]` one) so cleanup here can't sweep up
// calendar.spec.ts/event-management.spec.ts fixtures running concurrently in
// another worker against the same dev database (see docs/calendar.md).
const PREFIX = "[e2e-drag]";

const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping drag-reschedule DB-backed checks. " +
  "Set it locally (see .env.example) or on a Vercel preview to exercise this.";

// Far enough from `pnpm seed:events`'s fixture window and other specs'
// today-anchored fixtures that nothing else covers the dragged block/chip.
const anchor = new Date();
anchor.setHours(0, 0, 0, 0);
anchor.setDate(anchor.getDate() + 90);
const anchorParam = formatDateParam(anchor);

function at(hour: number, minute = 0): Date {
  const date = new Date(anchor);
  date.setHours(hour, minute, 0, 0);
  return date;
}

const EVENT_BLOCK = '[data-slot="event-block"]';
const EVENT_CHIP = '[data-slot="event-chip"]';
const DAY_COLUMN = '[data-slot="day-column"]';
const MONTH_CELL = '[data-slot="month-cell"]';

test.describe("drag-reschedule", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await clearEventsWithPrefix(PREFIX);
  });

  test("dragging an event to a new time in day view persists after reload", async ({
    page,
  }) => {
    const title = `${PREFIX} Day move`;
    await insertTestEvent({
      title,
      track: "work",
      startsAt: at(9),
      endsAt: at(10),
    });
    await page.goto(`/calendar?view=day&date=${anchorParam}`);

    const block = page.locator(EVENT_BLOCK, { hasText: title });
    await expect(block).toBeVisible();
    // page.mouse uses raw viewport coordinates and (unlike .click()) never
    // auto-scrolls — the time grid is a scrollable ancestor, so an event
    // outside the initial fold needs an explicit scroll first.
    await block.scrollIntoViewIfNeeded();
    const box = (await block.boundingBox())!;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // One hour grid row is 64px (HOUR_HEIGHT_REM=4rem @ 16px root) — moving
    // down by exactly that snaps to a clean +1h shift.
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY + 64, { steps: 10 });
    await page.mouse.up();

    await expect(
      page.locator("[data-sonner-toast]", { hasText: title })
    ).toBeVisible();
    await expect(block).toContainText("10:00–11:00");

    await page.reload();
    await expect(page.locator(EVENT_BLOCK, { hasText: title })).toContainText(
      "10:00–11:00"
    );
    const persisted = await getTestEventTimes(title);
    expect(persisted?.startsAt).toEqual(at(10));
    expect(persisted?.endsAt).toEqual(at(11));
  });

  test("dragging an event across days in week view persists after reload", async ({
    page,
  }) => {
    const title = `${PREFIX} Week cross-day move`;
    await insertTestEvent({
      title,
      track: "content",
      startsAt: at(9),
      endsAt: at(10),
    });
    await page.goto(`/calendar?view=week&date=${anchorParam}`);

    const block = page.locator(EVENT_BLOCK, { hasText: title });
    await expect(block).toBeVisible();
    await block.scrollIntoViewIfNeeded();

    const columns = page.locator(DAY_COLUMN);
    const box0 = (await columns.nth(0).boundingBox())!;
    const box1 = (await columns.nth(1).boundingBox())!;
    const columnWidth = box1.x - box0.x;

    const box = (await block.boundingBox())!;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // One column right, no vertical change — moves a day, keeps the time.
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + columnWidth, centerY, { steps: 10 });
    await page.mouse.up();

    await expect(
      page.locator("[data-sonner-toast]", { hasText: title })
    ).toBeVisible();

    await page.reload();
    const tomorrowParam = formatDateParam(
      new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 1)
    );
    await page.goto(`/calendar?view=day&date=${tomorrowParam}`);
    await expect(page.locator(EVENT_BLOCK, { hasText: title })).toContainText(
      "09:00–10:00"
    );
  });

  test("resizing an event's bottom edge changes its duration and persists", async ({
    page,
  }) => {
    const title = `${PREFIX} Resize bottom edge`;
    await insertTestEvent({
      title,
      track: "work",
      startsAt: at(9),
      endsAt: at(10),
    });
    await page.goto(`/calendar?view=day&date=${anchorParam}`);

    const handle = page
      .locator(EVENT_BLOCK, { hasText: title })
      .locator('[data-slot="resize-end-handle"]');
    await expect(handle).toBeAttached();
    await handle.scrollIntoViewIfNeeded();
    const box = (await handle.boundingBox())!;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // 30 minutes at 64px/hour.
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY + 32, { steps: 10 });
    await page.mouse.up();

    await expect(page.locator(EVENT_BLOCK, { hasText: title })).toContainText(
      "09:00–10:30"
    );

    await page.reload();
    const persisted = await getTestEventTimes(title);
    expect(persisted?.startsAt).toEqual(at(9));
    expect(persisted?.endsAt).toEqual(at(10, 30));
  });

  test("dragging a month-view chip to another day persists after reload", async ({
    page,
  }) => {
    const title = `${PREFIX} Month chip move`;
    await insertTestEvent({
      title,
      track: "work",
      startsAt: at(0),
      endsAt: at(0),
      allDay: true,
    });
    await page.goto(`/calendar?view=month&date=${anchorParam}`);

    const chip = page.locator(EVENT_CHIP, { hasText: title });
    await expect(chip).toBeVisible();
    await chip.scrollIntoViewIfNeeded();
    const chipBox = (await chip.boundingBox())!;

    const originCell = page.locator(MONTH_CELL).filter({ has: chip });
    const targetCell = originCell.locator(
      'xpath=following-sibling::*[@data-slot="month-cell"][1]'
    );
    await targetCell.scrollIntoViewIfNeeded();
    const targetBox = (await targetCell.boundingBox())!;

    await page.mouse.move(
      chipBox.x + chipBox.width / 2,
      chipBox.y + chipBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 10 }
    );
    await page.mouse.up();

    await expect(
      page.locator("[data-sonner-toast]", { hasText: title })
    ).toBeVisible();

    await page.reload();
    const nextDayParam = formatDateParam(
      new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 1)
    );
    await page.goto(`/calendar?view=day&date=${nextDayParam}`);
    await expect(page.getByText(title)).toBeVisible();
  });

  test("a failed reschedule (concurrent deletion) reverts and shows an error toast", async ({
    page,
  }) => {
    const title = `${PREFIX} Concurrent deletion`;
    await insertTestEvent({
      title,
      track: "work",
      startsAt: at(9),
      endsAt: at(10),
    });
    await page.goto(`/calendar?view=day&date=${anchorParam}`);

    const block = page.locator(EVENT_BLOCK, { hasText: title });
    await expect(block).toBeVisible();
    await block.scrollIntoViewIfNeeded();
    const box = (await block.boundingBox())!;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY + 64, { steps: 10 });
    // The row is gone by the time the server action runs, mirroring another
    // client deleting it mid-drag — same "no longer exists" path as the
    // editor's own delete/update races.
    await deleteTestEventByTitle(title);
    await page.mouse.up();

    await expect(
      page.locator("[data-sonner-toast]", { hasText: "no longer exists" })
    ).toBeVisible();
    await expect(page.locator(EVENT_BLOCK, { hasText: title })).toContainText(
      "09:00–10:00"
    );
  });
});

test.describe("drag-reschedule mobile viewport", () => {
  test.use({
    viewport: devices["Pixel 7"].viewport,
    hasTouch: devices["Pixel 7"].hasTouch,
    isMobile: devices["Pixel 7"].isMobile,
  });
  test.skip(skip, skipReason);

  test.afterEach(async () => {
    await clearEventsWithPrefix(PREFIX);
  });

  test("long-press then drag reschedules an event on touch", async ({
    page,
  }) => {
    const title = `${PREFIX} Mobile long-press move`;
    await insertTestEvent({
      title,
      track: "work",
      startsAt: at(9),
      endsAt: at(10),
    });
    await page.goto(`/calendar?view=day&date=${anchorParam}`);

    const block = page.locator(EVENT_BLOCK, { hasText: title });
    await expect(block).toBeVisible();
    const box = (await block.boundingBox())!;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Synthesized touch pointer events exercise the same useEventDrag state
    // machine a real long-press would, in a real browser rather than jsdom —
    // Playwright has no built-in "hold, then drag" touch gesture primitive.
    await block.dispatchEvent("pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      clientX: centerX,
      clientY: centerY,
      bubbles: true,
    });
    await page.waitForTimeout(450); // past LONG_PRESS_MS
    await page.dispatchEvent("body", "pointermove", {
      pointerId: 1,
      pointerType: "touch",
      clientX: centerX,
      clientY: centerY + 64,
      bubbles: true,
    });
    await page.dispatchEvent("body", "pointerup", {
      pointerId: 1,
      pointerType: "touch",
      clientX: centerX,
      clientY: centerY + 64,
      bubbles: true,
    });

    await expect(block).toContainText("10:00–11:00");
    await page.reload();
    await expect(page.locator(EVENT_BLOCK, { hasText: title })).toContainText(
      "10:00–11:00"
    );
  });
});
