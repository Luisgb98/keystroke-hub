import { expect, test } from "@playwright/test";

import { clearTestIdeas, seedTestIdea } from "./support/ideas-db";
import { clearTestProjects } from "./support/projects-db";
import { seedTestProject } from "./support/search-db";

// The content-search suite queries the database on every keystroke, so —
// like the ideas/projects/meetings suites — it only runs where DATABASE_URL
// is available (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping command palette content-search " +
  "checks. Set it locally (see .env.example) or on a Vercel preview to " +
  "exercise this.";

test.describe("command palette navigation", () => {
  test("Ctrl/Cmd-K opens the palette; typing narrows the list and Enter navigates", async ({
    page,
  }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "Command palette" });
    await expect(dialog).not.toBeVisible();

    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible();

    await page.keyboard.type("Journal");
    await expect(
      dialog.getByRole("option", { name: "Journal", exact: true })
    ).toBeVisible();
    await expect(
      dialog.getByRole("option", { name: "Dashboard", exact: true })
    ).not.toBeVisible();

    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/journal$/);
    await expect(dialog).not.toBeVisible();
  });

  test("a second Ctrl-K press toggles the palette closed", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "Command palette" });

    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Control+k");
    await expect(dialog).not.toBeVisible();
  });

  test("empty query shows the Navigate group immediately", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Command palette" });

    await expect(dialog.getByText("Navigate")).toBeVisible();
    await expect(
      dialog.getByRole("option", { name: "Dashboard", exact: true })
    ).toBeVisible();
    await expect(
      dialog.getByRole("option", { name: "Calendar", exact: true })
    ).toBeVisible();
  });

  test("Esc closes the palette and returns focus to the trigger that opened it", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Search" });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Command palette" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test("a query with no matches shows the empty state", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Command palette" });

    await page.keyboard.type("zzz-no-such-destination-zzz");
    await expect(
      dialog.getByText('No results for "zzz-no-such-destination-zzz".')
    ).toBeVisible();
  });
});

test.describe("command palette mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("tapping the bottom-nav Search button opens the palette and a tapped result navigates", async ({
    page,
  }) => {
    await page.goto("/");
    const trigger = page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: "Search" });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Command palette" });
    await expect(dialog).toBeVisible();

    await page.keyboard.type("Calendar");
    await dialog.getByRole("option", { name: "Calendar", exact: true }).click();

    await expect(page).toHaveURL(/\/calendar$/);
    await expect(dialog).not.toBeVisible();
  });
});

test.describe("command palette content search", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-palette]";

  test.afterEach(async () => {
    await clearTestProjects(PREFIX);
    await clearTestIdeas(PREFIX);
  });

  test("finds a work item and a content item for a shared query, each labeled with its world", async ({
    page,
  }) => {
    const token = `${PREFIX} ${Date.now()}`;
    const projectName = `${token} Project`;
    const ideaTitle = `${token} Idea`;
    await seedTestProject(projectName);
    await seedTestIdea({ title: ideaTitle });

    await page.goto("/");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Command palette" });

    await page.keyboard.type(token);

    await expect(dialog.getByText(projectName)).toBeVisible();
    await expect(dialog.getByText(ideaTitle)).toBeVisible();
    await expect(dialog.getByText("Projects", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Ideas", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Work · Project")).toBeVisible();
    await expect(dialog.getByText("Content · Idea")).toBeVisible();

    await dialog.getByText(projectName).click();
    await expect(page).toHaveURL(/\/projects\//);
  });
});
