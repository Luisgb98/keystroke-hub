import { expect, test, type Page } from "@playwright/test";

import { clearTestIdeas, seedTestIdea } from "./support/ideas-db";

// The board page queries the database on every render, so — like the ideas
// list and calendar — it can only be exercised where DATABASE_URL is
// available (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping board DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const BOARD_CARD_SELECTOR = '[data-slot="board-card"]';

/** The stage column whose header matches `label` — disambiguates from the move menu, which lists the same stage names. */
function column(page: Page, label: string) {
  return page
    .locator('[data-slot="stage-column"]')
    .filter({ has: page.getByRole("heading", { name: label, exact: true }) });
}

async function moveCard(page: Page, title: string, targetStatusLabel: string) {
  const card = page.locator(BOARD_CARD_SELECTOR, { hasText: title });
  await card.getByRole("button", { name: `Move "${title}"` }).click();
  await page.getByRole("menuitem", { name: targetStatusLabel }).click();
}

test.describe("content pipeline board", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-board]";

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("each idea renders in the column matching its stage", async ({
    page,
  }) => {
    const scriptedTitle = `${PREFIX} Scripted idea`;
    const editedTitle = `${PREFIX} Edited idea`;
    await seedTestIdea({ title: scriptedTitle, status: "scripted" });
    await seedTestIdea({ title: editedTitle, status: "edited" });

    await page.goto("/content/board");

    await expect(
      column(page, "Scripted").getByText(scriptedTitle)
    ).toBeVisible();
    await expect(column(page, "Edited").getByText(editedTitle)).toBeVisible();
    await expect(column(page, "Edited").getByText(scriptedTitle)).toHaveCount(
      0
    );
  });

  test("moving a card via the menu updates its column and survives a reload", async ({
    page,
  }) => {
    const title = `${PREFIX} Move me`;
    await seedTestIdea({ title, status: "scripted" });
    await page.goto("/content/board");

    await moveCard(page, title, "Recorded");

    await expect(column(page, "Recorded").getByText(title)).toBeVisible();
    await expect(column(page, "Scripted").getByText(title)).toHaveCount(0);

    await page.reload();
    await expect(column(page, "Recorded").getByText(title)).toBeVisible();
  });

  test("shows exactly the five pipeline columns", async ({ page }) => {
    await page.goto("/content/board");

    await expect(page.locator('[data-slot="stage-column"]')).toHaveCount(5);
    for (const label of [
      "Idea",
      "Scripted",
      "Recorded",
      "Edited",
      "Published",
    ]) {
      await expect(column(page, label)).toBeVisible();
    }
    for (const removed of ["Spark", "Outlined", "Parked"]) {
      await expect(column(page, removed)).toHaveCount(0);
    }
  });

  test("a new idea starts in the Idea column and moves forward through the pipeline", async ({
    page,
  }) => {
    const title = `${PREFIX} Fresh idea`;
    await seedTestIdea({ title });
    await page.goto("/content/board");

    await expect(column(page, "Idea").getByText(title)).toBeVisible();

    await moveCard(page, title, "Scripted");
    await expect(column(page, "Scripted").getByText(title)).toBeVisible();
    await expect(column(page, "Idea").getByText(title)).toHaveCount(0);
  });
});

test.describe("content pipeline board mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  const PREFIX = "[e2e-board-mobile]";

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("columns scroll horizontally, and the move flow works one-handed", async ({
    page,
  }) => {
    const title = `${PREFIX} Mobile move`;
    await seedTestIdea({ title, status: "scripted" });
    await page.goto("/content/board");

    const board = page.locator('[data-slot="pipeline-board"]');
    await expect(board).toBeVisible();
    await expect
      .poll(() => board.evaluate((el) => el.scrollWidth))
      .toBeGreaterThan(await board.evaluate((el) => el.clientWidth));

    await moveCard(page, title, "Recorded");
    await expect(column(page, "Recorded").getByText(title)).toBeVisible();
  });
});
