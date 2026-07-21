import { expect, test } from "@playwright/test";

import { clearTestImprovements } from "./support/improvements-db";
import { clearTestProjects } from "./support/projects-db";

// The improvements pages query the database on every render, so — like the
// projects/streams/content-links suites — this only runs where DATABASE_URL
// is available (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping improvements DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const ROW_SELECTOR = '[data-slot="improvement-row"]';
const PREFIX = "[e2e-improvement]";
const PROJECT_PREFIX = "[e2e-improvement-project]";

/** Creates an improvement through the real inline capture card. */
async function createImprovement(
  page: import("@playwright/test").Page,
  title: string
) {
  await page.goto("/projects/improvements");
  await page.getByLabel("New improvement").fill(title);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByLabel("New improvement")).toHaveValue("", {
    timeout: 10000,
  });
}

/** Creates a project through the real inline capture card — same helper as projects.spec.ts. */
async function createProject(
  page: import("@playwright/test").Page,
  name: string
) {
  await page.goto("/projects");
  await page.getByLabel("New project").fill(name);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByLabel("New project")).toHaveValue("", {
    timeout: 10000,
  });
}

test.describe("improvements backlog", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await clearTestImprovements(PREFIX);
    await clearTestImprovements(PROJECT_PREFIX);
    await clearTestProjects(PROJECT_PREFIX);
  });

  test("quick-adding an improvement shows it on the agenda", async ({
    page,
  }) => {
    const title = `${PREFIX} Automate the changelog`;
    await createImprovement(page, title);
    await expect(page.locator(ROW_SELECTOR, { hasText: title })).toBeVisible();
  });

  test("linking a project at capture shows the chip and the item on the project's page", async ({
    page,
  }) => {
    const projectName = `${PROJECT_PREFIX} Keystroke Hub`;
    const title = `${PROJECT_PREFIX} Ship the release checklist`;
    await createProject(page, projectName);

    await page.goto("/projects/improvements");
    await page.getByLabel("New improvement").fill(title);
    await page.getByLabel("Related project (optional)").click();
    await page.getByRole("option", { name: projectName }).click();
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByLabel("New improvement")).toHaveValue("", {
      timeout: 10000,
    });

    const row = page.locator(ROW_SELECTOR, { hasText: title });
    await expect(row.getByRole("link", { name: projectName })).toBeVisible();

    await row.getByRole("link", { name: projectName }).click();
    await expect(page.getByText(title)).toBeVisible();
  });

  test("recording an outcome as accepted leaves the agenda and shows the outcome under All", async ({
    page,
  }) => {
    const title = `${PREFIX} Add a linting pre-commit hook`;
    await createImprovement(page, title);

    const row = page.locator(ROW_SELECTOR, { hasText: title });
    await row.getByRole("button", { name: "Record outcome" }).click();
    const dialog = page.getByRole("dialog", { name: "Record outcome" });
    await dialog.getByRole("radio", { name: "Accepted" }).click();
    await dialog.getByLabel("Outcome (optional)").fill("Adding it next sprint");
    await dialog.getByRole("button", { name: "Save outcome" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await expect(async () => {
      await page.reload();
      await expect(
        page.locator(ROW_SELECTOR, { hasText: title })
      ).not.toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });

    await page.getByRole("tab", { name: /^All/ }).click();
    const allRow = page.locator(ROW_SELECTOR, { hasText: title });
    await expect(allRow).toBeVisible();
    await expect(allRow.getByText("Adding it next sprint")).toBeVisible();
  });

  test("an accepted improvement can be marked done", async ({ page }) => {
    const title = `${PREFIX} Add a status page`;
    await createImprovement(page, title);

    const row = page.locator(ROW_SELECTOR, { hasText: title });
    await row.getByRole("button", { name: "Record outcome" }).click();
    const dialog = page.getByRole("dialog", { name: "Record outcome" });
    await dialog.getByRole("radio", { name: "Accepted" }).click();
    await dialog.getByRole("button", { name: "Save outcome" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.getByRole("tab", { name: /^All/ }).click();
    const allRow = page.locator(ROW_SELECTOR, { hasText: title });
    await allRow.getByLabel("Status").selectOption("done");
    await expect(allRow.locator('[data-slot="badge"]')).toHaveText("Done");
  });

  test("a rejected improvement stays off the agenda", async ({ page }) => {
    const title = `${PREFIX} Rewrite everything in Rust`;
    await createImprovement(page, title);

    const row = page.locator(ROW_SELECTOR, { hasText: title });
    await row.getByRole("button", { name: "Record outcome" }).click();
    const dialog = page.getByRole("dialog", { name: "Record outcome" });
    await dialog.getByRole("radio", { name: "Rejected" }).click();
    await dialog.getByRole("button", { name: "Save outcome" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await expect(async () => {
      await page.reload();
      await expect(
        page.locator(ROW_SELECTOR, { hasText: title })
      ).not.toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
  });
});

// A separate prefix, so this describe (no file-level `serial` mode of its
// own) can run concurrently with the main describe above without racing its
// `afterEach` cleanup — same precedent as projects.spec.ts.
const MOBILE_PREFIX = "[e2e-improvement-mobile]";

test.describe("improvements backlog mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  test.afterEach(async () => {
    await clearTestImprovements(MOBILE_PREFIX);
  });

  test("the inline capture card is usable for one-handed capture", async ({
    page,
  }) => {
    const title = `${MOBILE_PREFIX} Mobile capture`;
    await page.goto("/projects/improvements");

    await page.getByLabel("New improvement").fill(title);
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.locator(ROW_SELECTOR, { hasText: title })).toBeVisible({
      timeout: 10000,
    });
  });
});
