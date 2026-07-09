import { expect, test, type Page } from "@playwright/test";

import { clearTestIdeas, seedTestIdea } from "./support/ideas-db";

// The board page queries the database on every render, so — like
// board.spec.ts — this only runs where DATABASE_URL is available (local dev
// or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping publish checklist DB-backed checks. " +
  "Set it locally (see .env.example) or on a Vercel preview to exercise this.";

const BOARD_CARD_SELECTOR = '[data-slot="board-card"]';

/** The stage column whose header matches `label` — mirrors board.spec.ts's helper. */
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The board card's `n/m` progress chip — also the checklist dialog's trigger. */
function checklistChip(page: Page, title: string) {
  return page
    .locator(BOARD_CARD_SELECTOR, { hasText: title })
    .getByRole("button", {
      name: new RegExp(`Open publish checklist for "${escapeRegExp(title)}"`),
    });
}

test.describe("video publishing checklist", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-publish-checklist]";

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("moving an idea into Recorded seeds the four default checklist items", async ({
    page,
  }) => {
    const title = `${PREFIX} Boss rush`;
    await seedTestIdea({ title, status: "scripted" });
    await page.goto("/content/board");

    await moveCard(page, title, "Recorded");
    await expect(checklistChip(page, title)).toBeVisible();
    await checklistChip(page, title).click();

    const dialog = page.getByRole("dialog", { name: "Publish checklist" });
    await expect(dialog.getByText("Title")).toBeVisible();
    await expect(dialog.getByText("Thumbnail")).toBeVisible();
    await expect(dialog.getByText("Description")).toBeVisible();
    await expect(dialog.getByText("Tags")).toBeVisible();
  });

  test("toggling, adding, and removing items updates the board chip count", async ({
    page,
  }) => {
    const title = `${PREFIX} Checklist edits`;
    await seedTestIdea({ title, status: "scripted" });
    await page.goto("/content/board");

    await moveCard(page, title, "Recorded");
    await checklistChip(page, title).click();
    const dialog = page.getByRole("dialog", { name: "Publish checklist" });

    await dialog.getByRole("checkbox", { name: "Title" }).click();
    await dialog.getByRole("checkbox", { name: "Thumbnail" }).click();
    await dialog.getByLabel("Add checklist item").fill("Pin a comment");
    await dialog.getByRole("button", { name: "Add" }).click();
    await expect(dialog.getByText("Pin a comment")).toBeVisible();
    await dialog.getByRole("button", { name: 'Remove "Tags"' }).click();
    await expect(dialog.getByText("Tags", { exact: true })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    // 4 defaults - 1 removed ("Tags") + 1 added ("Pin a comment") = 4 total,
    // 2 checked ("Title", "Thumbnail").
    await expect(checklistChip(page, title)).toHaveText("2/4");
  });

  test("publishing with unchecked items shows a non-blocking nudge toast and still moves the card", async ({
    page,
  }) => {
    const title = `${PREFIX} Publish nudge`;
    await seedTestIdea({ title, status: "scripted" });
    await page.goto("/content/board");

    // Skips straight from scripted to published — still seeds the defaults
    // and immediately nudges, since none of them are checked yet.
    await moveCard(page, title, "Published");

    await expect(
      page.getByText(/Published with \d+ unchecked checklist items?/)
    ).toBeVisible();
    await expect(column(page, "Published").getByText(title)).toBeVisible();
  });

  test("completing every item avoids the nudge on publish", async ({
    page,
  }) => {
    const title = `${PREFIX} All done`;
    await seedTestIdea({ title, status: "scripted" });
    await page.goto("/content/board");

    await moveCard(page, title, "Edited");
    await checklistChip(page, title).click();
    const dialog = page.getByRole("dialog", { name: "Publish checklist" });
    for (const label of ["Title", "Thumbnail", "Description", "Tags"]) {
      await dialog.getByRole("checkbox", { name: label }).click();
    }
    await page.keyboard.press("Escape");
    await expect(checklistChip(page, title)).toHaveText("4/4");

    await moveCard(page, title, "Published");

    await expect(column(page, "Published").getByText(title)).toBeVisible();
    await expect(page.getByText(/unchecked checklist item/)).toHaveCount(0);
  });
});

const MOBILE_PREFIX = "[e2e-publish-checklist-mobile]";

test.describe("video publishing checklist mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  test.afterEach(async () => {
    await clearTestIdeas(MOBILE_PREFIX);
  });

  test("the checklist chip opens the dialog and the toggle flow works one-handed", async ({
    page,
  }) => {
    const title = `${MOBILE_PREFIX} Mobile checklist`;
    await seedTestIdea({ title, status: "scripted" });
    await page.goto("/content/board");

    await moveCard(page, title, "Recorded");
    await checklistChip(page, title).click();

    const dialog = page.getByRole("dialog", { name: "Publish checklist" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("checkbox", { name: "Title" }).click();
    await expect(dialog.getByRole("checkbox", { name: "Title" })).toBeChecked();

    await page.keyboard.press("Escape");
    await expect(checklistChip(page, title)).toHaveText("1/4");
  });
});
