import { expect, test } from "@playwright/test";

import {
  clearTestIdeas,
  clearTestProjects,
  seedTestIdea,
} from "./support/projects-db";

// The projects pages query the database on every render, so — like the
// ideas/streams/content-links suites — this only runs where DATABASE_URL is
// available (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping projects DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const PROJECT_CARD_SELECTOR = '[data-slot="project-card"]';
const PREFIX = "[e2e-project]";

/** Creates a project through the real inline capture card. */
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

test.describe("projects tracker", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await clearTestProjects(PREFIX);
    await clearTestIdeas(PREFIX);
  });

  test("creating a project shows it in the active list", async ({ page }) => {
    const name = `${PREFIX} Keystroke Hub`;
    await createProject(page, name);
    await expect(
      page.locator(PROJECT_CARD_SELECTOR, { hasText: name })
    ).toBeVisible();
  });

  test("changing status on the detail page persists across reload", async ({
    page,
  }) => {
    const name = `${PREFIX} Status project`;
    await createProject(page, name);
    await page.locator(PROJECT_CARD_SELECTOR, { hasText: name }).click();

    await page.getByLabel("Status").selectOption("paused");
    await expect(page.getByLabel("Status")).toHaveValue("paused");

    await page.reload();
    await expect(page.getByLabel("Status")).toHaveValue("paused");
  });

  test("writing running notes saves and survives a reload", async ({
    page,
  }) => {
    const name = `${PREFIX} Notes project`;
    await createProject(page, name);
    await page.locator(PROJECT_CARD_SELECTOR, { hasText: name }).click();

    const notes = "Kickoff done, waiting on the design review.";
    await page.getByLabel("Running notes").fill(notes);
    // Exact match — "Saved" is a case-insensitive substring of "Unsaved
    // changes" (the dirty-state indicator shown immediately after typing),
    // so a loose match would resolve before the debounced autosave fires.
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({
      timeout: 5000,
    });

    await page.reload();
    await expect(page.getByLabel("Running notes")).toHaveValue(notes);
  });

  test("linking an idea from the project page shows it on both sides", async ({
    page,
  }) => {
    const projectName = `${PREFIX} Linking project`;
    const ideaTitle = `${PREFIX} Unassigned idea`;
    await seedTestIdea(ideaTitle);

    await createProject(page, projectName);
    await page.locator(PROJECT_CARD_SELECTOR, { hasText: projectName }).click();

    await page.getByRole("button", { name: "Link an idea" }).click();
    const dialog = page.getByRole("dialog", { name: "Link an idea" });
    await dialog.getByLabel("Search ideas").fill(ideaTitle);
    await dialog.getByText(ideaTitle).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await expect(page.getByRole("link", { name: ideaTitle })).toBeVisible();

    await page.goto(`/content/ideas?q=${encodeURIComponent(ideaTitle)}`);
    await expect(page.getByRole("link", { name: projectName })).toBeVisible();
  });

  test("archiving hides a project from the active list but keeps it under Archived with links intact", async ({
    page,
  }) => {
    const projectName = `${PREFIX} Archive project`;
    await createProject(page, projectName);
    await page.locator(PROJECT_CARD_SELECTOR, { hasText: projectName }).click();

    await page.getByRole("button", { name: "Project actions" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Archive" })
      .click();

    // A single `page.goto` only fetches once. Two races can make a bare
    // `.not.toBeVisible()` check right after pass for the wrong reason: the
    // route's `loading.tsx` skeleton (no project text at all) can still be
    // on screen when the check runs, and Neon's HTTP driver can lag read-
    // after-write by a few hundred ms (same quirk `streams.spec.ts`
    // documents for its own delete-and-reload check). Waiting for real
    // content (`ProjectCapture`'s "New project" field, absent from the
    // skeleton) first rules out the former; `toPass` retrying the whole
    // navigation covers the latter.
    await expect(async () => {
      await page.goto("/projects");
      await expect(page.getByLabel("New project")).toBeVisible({
        timeout: 5000,
      });
      await expect(
        page.locator(PROJECT_CARD_SELECTOR, { hasText: projectName })
      ).not.toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });

    await page.getByRole("button", { name: /^Archived/ }).click();
    await expect(
      page.locator(PROJECT_CARD_SELECTOR, { hasText: projectName })
    ).toBeVisible();
  });

  test("unarchiving returns a project to the active list", async ({ page }) => {
    const projectName = `${PREFIX} Unarchive project`;
    await createProject(page, projectName);
    await page.locator(PROJECT_CARD_SELECTOR, { hasText: projectName }).click();

    await page.getByRole("button", { name: "Project actions" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Archive" })
      .click();

    // Same Neon read-after-write lag as the archiving test above — retry
    // the reload until the header actually reflects the archived state.
    await expect(async () => {
      await page.reload();
      await expect(page.getByText("Archived", { exact: true })).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 10000 });

    await page.getByRole("button", { name: "Project actions" }).click();
    await page.getByRole("menuitem", { name: "Unarchive" }).click();

    await expect(async () => {
      await page.goto("/projects");
      await expect(
        page.locator(PROJECT_CARD_SELECTOR, { hasText: projectName })
      ).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 10000 });
  });
});

// A separate prefix, so this describe (no file-level `serial` mode of its
// own) can run concurrently with the main describe above without racing its
// `afterEach` cleanup — same precedent as streams.spec.ts.
const MOBILE_PREFIX = "[e2e-project-mobile]";

test.describe("projects tracker mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  test.afterEach(async () => {
    await clearTestProjects(MOBILE_PREFIX);
  });

  test("the inline capture card is usable for one-handed capture", async ({
    page,
  }) => {
    const name = `${MOBILE_PREFIX} Mobile capture`;
    await page.goto("/projects");

    await page.getByLabel("New project").fill(name);
    await page.getByRole("button", { name: "Add" }).click();

    await expect(
      page.locator(PROJECT_CARD_SELECTOR, { hasText: name })
    ).toBeVisible({ timeout: 10000 });
  });
});
