import { expect, test } from "@playwright/test";

import { clearTestIdeas, seedTestIdea } from "./support/ideas-db";

// The ideas page queries the database on every render, so — like the
// calendar and health checks — it can only be exercised where DATABASE_URL
// is available (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping ideas DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const IDEA_CARD_SELECTOR = '[data-slot="idea-card"]';

test.describe("idea capture", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-idea-capture]";

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("captures a title-only idea, which appears at the initial status", async ({
    page,
  }) => {
    const title = `${PREFIX} Speedrun commentary`;
    await page.goto("/content/ideas");

    await page.getByRole("button", { name: "New idea" }).click();
    const dialog = page.getByRole("dialog", { name: "New idea" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    await expect(card).toBeVisible();
    await expect(card.getByLabel("Status", { exact: true })).toHaveValue(
      "spark"
    );
  });

  test("captures full input — notes, format, and tags all render", async ({
    page,
  }) => {
    const title = `${PREFIX} Glitch tutorial`;
    await page.goto("/content/ideas");

    await page.getByRole("button", { name: "New idea" }).click();
    const dialog = page.getByRole("dialog", { name: "New idea" });
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("radio", { name: "Video" }).click();
    await dialog.getByLabel("Notes").fill("Cover the wrong warp");
    await dialog.getByLabel("Tags").fill("speedrun, glitch");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    await expect(card).toBeVisible();
    await expect(card.getByText("Video")).toBeVisible();
    await expect(card.getByText("speedrun")).toBeVisible();
    // Exact match: "Glitch tutorial" (the title) case-insensitively
    // substring-matches "glitch" too, so the default matcher is ambiguous.
    await expect(card.getByText("glitch", { exact: true })).toBeVisible();
  });

  test("changing status commits immediately and survives a reload", async ({
    page,
  }) => {
    const title = `${PREFIX} Status change`;
    await seedTestIdea({ title });
    await page.goto("/content/ideas");

    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    await card.getByLabel("Status", { exact: true }).selectOption("outlined");
    await expect(card.getByLabel("Status", { exact: true })).toHaveValue(
      "outlined"
    );

    await page.reload();
    await expect(
      page
        .locator(IDEA_CARD_SELECTOR, { hasText: title })
        .getByLabel("Status", { exact: true })
    ).toHaveValue("outlined");
  });

  test("delete requires confirmation; cancel keeps the idea", async ({
    page,
  }) => {
    const title = `${PREFIX} Deletable idea`;
    await seedTestIdea({ title });
    await page.goto("/content/ideas");

    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    await card.getByRole("button", { name: `Delete "${title}"` }).click();

    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).not.toBeVisible();
    await expect(card).toBeVisible();

    await card.getByRole("button", { name: `Delete "${title}"` }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(card).toHaveCount(0);
  });
});

test.describe("idea filters", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-idea-filters]";
  const videoTitle = `${PREFIX} Video only idea`;
  const streamTitle = `${PREFIX} Stream only idea`;

  test.beforeAll(async () => {
    await seedTestIdea({
      title: videoTitle,
      format: "video",
      tags: ["speedrun"],
    });
    await seedTestIdea({
      title: streamTitle,
      format: "stream",
      status: "outlined",
    });
  });

  test.afterAll(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("search filters by title, reflects in the URL, and survives a reload", async ({
    page,
  }) => {
    await page.goto("/content/ideas");
    await page.getByLabel("Search ideas").fill(videoTitle);

    await expect(page).toHaveURL(
      new RegExp(
        `q=${encodeURIComponent(videoTitle).replace(/%20/g, "(%20|\\+)")}`
      ),
      { timeout: 5000 }
    );
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: videoTitle })
    ).toBeVisible();
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: streamTitle })
    ).toHaveCount(0);

    await page.reload();
    await expect(page.getByLabel("Search ideas")).toHaveValue(videoTitle);
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: videoTitle })
    ).toBeVisible();
  });

  test("filtering by format shows only matching ideas", async ({ page }) => {
    await page.goto("/content/ideas");
    await page
      .getByRole("group", { name: "Filter by format" })
      .getByRole("button", { name: "Video" })
      .click();

    await expect(page).toHaveURL(/format=video/);
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: videoTitle })
    ).toBeVisible();
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: streamTitle })
    ).toHaveCount(0);
  });

  test("filtering by status shows only matching ideas", async ({ page }) => {
    await page.goto("/content/ideas");
    await page
      .getByRole("group", { name: "Filter by status" })
      .getByRole("button", { name: "Outlined" })
      .click();

    await expect(page).toHaveURL(/status=outlined/);
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: streamTitle })
    ).toBeVisible();
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: videoTitle })
    ).toHaveCount(0);
  });

  test("filtering by tag shows only matching ideas", async ({ page }) => {
    await page.goto("/content/ideas");
    await page.getByText("#speedrun").click();

    await expect(page).toHaveURL(/tag=speedrun/);
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: videoTitle })
    ).toBeVisible();
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: streamTitle })
    ).toHaveCount(0);
  });

  test("combining filters narrows further, and reset clears them", async ({
    page,
  }) => {
    await page.goto("/content/ideas");
    await page
      .getByRole("group", { name: "Filter by format" })
      .getByRole("button", { name: "Video" })
      .click();
    await page.getByText("#speedrun").click();

    await expect(page).toHaveURL(/format=video/);
    await expect(page).toHaveURL(/tag=speedrun/);
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: videoTitle })
    ).toBeVisible();

    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(page).toHaveURL("/content/ideas");
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: streamTitle })
    ).toBeVisible();
  });

  test("a search with no matches shows the 'no matching ideas' empty state", async ({
    page,
  }) => {
    await page.goto("/content/ideas?q=zzz-no-such-idea-zzz");
    await expect(page.getByText("No matching ideas")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reset filters" })
    ).toBeVisible();
  });
});

test.describe("idea capture mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  const PREFIX = "[e2e-idea-mobile]";

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("the floating 'New idea' button opens the dialog for one-handed capture", async ({
    page,
  }) => {
    const title = `${PREFIX} Mobile capture`;
    await page.goto("/content/ideas");

    await page.getByRole("button", { name: "New idea" }).click();
    const dialog = page.getByRole("dialog", { name: "New idea" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Title")).toBeFocused();
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: title })
    ).toBeVisible();
  });
});
