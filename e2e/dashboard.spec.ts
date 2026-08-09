import { expect, test } from "@playwright/test";

import { clearTestDailyLogItemsByTitle } from "./support/daily-logs-db";
import { clearEventsWithPrefix, insertTestEvent } from "./support/events-db";
import { clearTestGames, seedTestGame } from "./support/games-db";
import { clearTestIdeas, seedTestIdea } from "./support/ideas-db";
import { clearTestStreams, seedTestStream } from "./support/streams-db";
import {
  currentMonthParam,
  formatMonthLabel,
  shiftMonthParam,
} from "../lib/dashboard/month-review";

const PREFIX = "[e2e-dashboard]";
const WORK_EVENT_TITLE = `${PREFIX} Standup`;
const STUCK_IDEA_TITLE = `${PREFIX} Stuck idea`;
const SCRIPTED_IDEA_TITLE = `${PREFIX} Scripted idea`;
const LOG_ITEM_TITLE = `${PREFIX} Ship the dashboard`;

const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping dashboard DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const AGENDA_ITEM_SELECTOR = '[data-slot="agenda-item"]';

// Mirrors agenda.spec.ts: one file, serialized, own seed prefix so this
// suite's rows can't race another spec's concurrently-running fixtures
// against the same dev database.
test.describe.configure({ mode: "serial" });

test.describe("dashboard", () => {
  test.skip(skip, skipReason);

  test.beforeAll(async () => {
    const now = new Date();
    await insertTestEvent({
      title: WORK_EVENT_TITLE,
      track: "work",
      startsAt: new Date(now.getTime() + 60 * 60 * 1000),
      endsAt: new Date(now.getTime() + 1.5 * 60 * 60 * 1000),
    });
    // Backdated so it's deterministically the "stuck longest" pick
    // regardless of whatever else exists in the dev database.
    await seedTestIdea({
      title: STUCK_IDEA_TITLE,
      status: "idea",
      stageEnteredAt: new Date("2000-01-01"),
    });
    await seedTestIdea({ title: SCRIPTED_IDEA_TITLE, status: "scripted" });
  });

  test.afterAll(async () => {
    await clearEventsWithPrefix(PREFIX);
    await clearTestIdeas(PREFIX);
    await clearTestDailyLogItemsByTitle(PREFIX);
  });

  test("shows today's seeded event in the agenda block, deep-linking to the calendar", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeVisible();
    await expect(
      page.locator(AGENDA_ITEM_SELECTOR, { hasText: WORK_EVENT_TITLE })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View calendar →" })
    ).toHaveAttribute("href", "/calendar?view=day");
  });

  test("shows per-stage counts and the stuck-longest idea in the content block, deep-linking to the board", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText("Content in flight")).toBeVisible();
    // Pinned to the card's own `<stage> · <count>` badge: since #110 the page
    // also carries an "Ideas captured" tile and an "Idea" pipeline row, so a
    // bare /Idea/ match is ambiguous.
    await expect(page.getByText(/^Idea · \d+$/)).toBeVisible();
    await expect(page.getByText(STUCK_IDEA_TITLE)).toBeVisible();

    await page.getByRole("link", { name: "Open board →" }).click();
    await expect(page).toHaveURL("/content/board");
  });

  test("today's log CTA reflects an added item and deep-links into the journal and standup", async ({
    page,
  }) => {
    // Written against the real "today" (like the journal mobile-viewport
    // check in mobile.spec.ts) since the dashboard only ever shows today's
    // log — cleanup only removes this prefix's item, never the day's
    // retro/mood or any other real item.
    await page.goto("/journal");
    await page.getByLabel("Add planned item").fill(LOG_ITEM_TITLE);
    await page.keyboard.press("Enter");
    // Same reason as the journal case in mobile.spec.ts: `QuickAdd` waits on
    // the server action's `revalidatePath` refresh, and 5s is tight under a
    // full parallel run — which this suite now shares with a heavier `/`.
    await expect(page.getByText(LOG_ITEM_TITLE)).toBeVisible({
      timeout: 15000,
    });

    await page.goto("/");
    await expect(page.getByText("Today's log")).toBeVisible();
    const continueLink = page.getByRole("button", {
      name: "Continue today's log",
    });
    await expect(continueLink).toBeVisible();
    await expect(page.getByText(/planned/)).toBeVisible();

    await continueLink.click();
    await expect(page).toHaveURL(/\/journal$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Standup" }).click();
    await expect(page).toHaveURL("/journal/standup");
  });
});

// --- The month review (issue #110) ---

const MONTH_PREFIX = "[e2e-month-review]";
// A month from before the app existed, so the seeded rows below are the
// *only* rows in it and the counts can be asserted exactly — the dev
// database is shared and full of real work, which rules out asserting on
// any current-month total. Deliberately not a `${PREFIX}%` sub-prefix: the
// suite above clears by `LIKE`, and that would sweep these rows too.
const REVIEW_MONTH = "2019-04";
const GAME_NAME = `${MONTH_PREFIX} Rift Runner`;
const TAG = "e2e-speedrun";
const SECOND_TAG = "e2e-vod";
const STREAM_TITLE = `${MONTH_PREFIX} April stream`;
const PUBLISHED_TITLES = [
  `${MONTH_PREFIX} Published one`,
  `${MONTH_PREFIX} Published two`,
];
const CAPTURED_TITLE = `${MONTH_PREFIX} Captured in April`;

/** All instants, no wall-clock strings — the runner is in Madrid and the server in UTC (see docs/timezone.md). */
const at = (iso: string) => new Date(iso);

const STAT_TILE = '[data-slot="stat-tile"]';
const RANKING_BARS = '[data-slot="ranking-bars"]';

type Page = import("@playwright/test").Page;

function statTile(page: Page, label: string) {
  return page.locator(STAT_TILE, { hasText: label });
}

/** Scoped to the picker: "August 2026" must come from the stepper, not from some other label that happens to contain it. */
function monthPicker(page: Page) {
  return page.locator('[data-slot="month-picker"]');
}

test.describe("dashboard month review", () => {
  test.skip(skip, skipReason);

  test.beforeAll(async () => {
    const gameId = await seedTestGame(GAME_NAME);

    // April 2019: two videos published, one stream held, three ideas captured.
    await seedTestIdea({
      title: PUBLISHED_TITLES[0],
      status: "published",
      createdAt: at("2019-04-02T09:00:00Z"),
      stageEnteredAt: at("2019-04-10T09:00:00Z"),
      tags: [TAG, SECOND_TAG],
      gameId,
    });
    await seedTestIdea({
      title: PUBLISHED_TITLES[1],
      status: "published",
      createdAt: at("2019-04-03T09:00:00Z"),
      stageEnteredAt: at("2019-04-12T09:00:00Z"),
      tags: [TAG],
      gameId,
    });
    // No game on purpose: the "No game" bucket has to be counted, not dropped.
    await seedTestIdea({
      title: CAPTURED_TITLE,
      status: "idea",
      createdAt: at("2019-04-05T09:00:00Z"),
      stageEnteredAt: at("2019-04-05T09:00:00Z"),
      tags: [TAG],
    });
    await seedTestStream({
      title: STREAM_TITLE,
      startsAt: at("2019-04-20T16:00:00Z"),
      gameId,
    });

    // March 2019, so the deltas have something real to compare against.
    await seedTestIdea({
      title: `${MONTH_PREFIX} Published in March`,
      status: "published",
      createdAt: at("2019-03-01T09:00:00Z"),
      stageEnteredAt: at("2019-03-11T09:00:00Z"),
    });
  });

  test.afterAll(async () => {
    await clearTestIdeas(MONTH_PREFIX);
    await clearTestStreams(MONTH_PREFIX);
    await clearEventsWithPrefix(MONTH_PREFIX);
    await clearTestGames(MONTH_PREFIX);
  });

  test("lands on the current month, and stepping back survives a reload", async ({
    page,
  }) => {
    const thisMonth = currentMonthParam();
    const lastMonth = shiftMonthParam(thisMonth, -1);

    await page.goto("/");
    await expect(monthPicker(page)).toContainText(formatMonthLabel(thisMonth));
    // There is no future to review.
    await expect(
      page.getByRole("button", { name: "Next month" })
    ).toBeDisabled();

    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(page).toHaveURL(`/?month=${lastMonth}`);
    await expect(monthPicker(page)).toContainText(formatMonthLabel(lastMonth));

    // The month lives in the URL, so a reload can't lose it.
    await page.reload();
    await expect(page).toHaveURL(`/?month=${lastMonth}`);
    await expect(monthPicker(page)).toContainText(formatMonthLabel(lastMonth));

    await page.getByRole("button", { name: "This month" }).click();
    await expect(monthPicker(page)).toContainText(formatMonthLabel(thisMonth));
  });

  test("a future or malformed month in the URL falls back to the current one", async ({
    page,
  }) => {
    const thisMonthLabel = formatMonthLabel(currentMonthParam());

    await page.goto("/?month=2099-01");
    await expect(monthPicker(page)).toContainText(thisMonthLabel);

    await page.goto("/?month=banana");
    await expect(monthPicker(page)).toContainText(thisMonthLabel);
  });

  test("shows the seeded month's output with deltas against the month before", async ({
    page,
  }) => {
    await page.goto(`/?month=${REVIEW_MONTH}`);
    await expect(monthPicker(page)).toContainText(
      formatMonthLabel(REVIEW_MONTH)
    );

    // March had one published video and no streams, hence +1 on both.
    await expect(statTile(page, "Videos published")).toContainText("2");
    await expect(statTile(page, "Videos published")).toContainText("+1 vs Mar");
    await expect(statTile(page, "Streams")).toContainText("1");
    await expect(statTile(page, "Streams")).toContainText("+1 vs Mar");
    await expect(statTile(page, "Ideas captured")).toContainText("3");
    await expect(statTile(page, "Ideas captured")).toContainText("+2 vs Mar");

    await expect(
      page.getByText("2 ideas reached recording or beyond this month.")
    ).toBeVisible();
  });

  test("ranks the month's games and hashtags, counting untagged work as 'No game'", async ({
    page,
  }) => {
    await page.goto(`/?month=${REVIEW_MONTH}`);

    const games = page.locator(RANKING_BARS).first();
    await expect(games.getByText(GAME_NAME)).toBeVisible();
    await expect(games.getByText("2 ideas · 1 stream")).toBeVisible();
    await expect(games.getByText("No game")).toBeVisible();

    await expect(page.getByText(`#${TAG}`)).toBeVisible();
    await expect(page.getByText(`#${SECOND_TAG}`)).toBeVisible();
  });

  test("a month before the app existed renders honest zeros, not a broken chart", async ({
    page,
  }) => {
    await page.goto("/?month=2018-01");

    await expect(statTile(page, "Videos published")).toContainText("0");
    await expect(statTile(page, "Videos published")).toContainText(
      "Same as Dec"
    );
    await expect(statTile(page, "Streams")).toContainText("0");
    await expect(
      page.getByText(/Nothing tagged with a game this month/)
    ).toBeVisible();
    await expect(
      page.getByText("No hashtags on this month’s ideas yet.")
    ).toBeVisible();
    await expect(
      page.getByText("Nothing reached recording or beyond this month.")
    ).toBeVisible();
  });

  test("a game row is a door into the ideas view filtered by that game", async ({
    page,
  }) => {
    await page.goto(`/?month=${REVIEW_MONTH}`);

    // `hasText` takes the name literally — `GAME_NAME` carries `[`/`]`, which
    // a regex would read as a character class and never match.
    await page.locator(`${RANKING_BARS} a`, { hasText: GAME_NAME }).click();
    await expect(page).toHaveURL(/\/content\/ideas\?game=/);
    await expect(page.getByText(PUBLISHED_TITLES[0])).toBeVisible();
    await expect(page.getByText(CAPTURED_TITLE)).toBeHidden();
  });

  test("a hashtag row is a door into the ideas view filtered by that tag", async ({
    page,
  }) => {
    await page.goto(`/?month=${REVIEW_MONTH}`);

    await page.getByRole("link", { name: `#${SECOND_TAG}` }).click();
    await expect(page).toHaveURL(`/content/ideas?tag=${SECOND_TAG}`);
    await expect(page.getByText(PUBLISHED_TITLES[0])).toBeVisible();
    await expect(page.getByText(PUBLISHED_TITLES[1])).toBeHidden();
  });
});

test.describe("dashboard mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  test("date header and today's log block are visible above the fold, no horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeInViewport();
    await expect(page.getByText("Today's log")).toBeInViewport();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("the month review reflows on a phone: numbers first, rankings stacked, no overflow", async ({
    page,
  }) => {
    await page.goto(`/?month=${REVIEW_MONTH}`);

    await expect(
      page.getByRole("heading", { level: 2, name: "The month" })
    ).toBeVisible();

    // The headline numbers are the first thing the review shows — the
    // rankings elaborate on them, so they come after.
    const tiles = page.locator(STAT_TILE);
    await expect(tiles).toHaveCount(3);
    const firstTile = await tiles.first().boundingBox();
    const rankings = await page
      .locator('[data-slot="month-rankings"]')
      .boundingBox();
    expect(firstTile!.y).toBeLessThan(rankings!.y);

    // Stacked, not squeezed side by side.
    const secondTile = await tiles.nth(1).boundingBox();
    expect(secondTile!.y).toBeGreaterThan(firstTile!.y);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
