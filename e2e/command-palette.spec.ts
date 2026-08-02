import { expect, test, type Page } from "@playwright/test";

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

const PALETTE = { name: "Command palette" } as const;

/**
 * Opens the palette with its shortcut, retrying the press. The Cmd/Ctrl-K
 * binding is attached by a client effect, so on a freshly loaded page the very
 * first press can land before hydration — and a lost press looks exactly like
 * a broken shortcut. The loop self-heals if a press does register late: it
 * simply presses again from whatever state it finds.
 */
async function openWithShortcut(page: Page) {
  const dialog = page.getByRole("dialog", PALETTE);
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(dialog).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  return dialog;
}

test.describe("command palette navigation", () => {
  test("Ctrl/Cmd-K opens the palette; typing narrows the list and Enter navigates", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("dialog", PALETTE)).not.toBeVisible();

    const dialog = await openWithShortcut(page);

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
    const dialog = await openWithShortcut(page);

    await page.keyboard.press("Control+k");
    await expect(dialog).not.toBeVisible();
  });

  // #102 handed this combo back to the browser: the script editor is a page of
  // prose, and finding a word inside a script needs real find-in-page, which
  // only Ctrl/Cmd-F opens. The palette must not intercept it.
  test("Ctrl-F no longer opens the palette, leaving find-in-page to the browser (#102)", async ({
    page,
  }) => {
    await page.goto("/");

    // Open-then-close with the real shortcut first: that proves the listener is
    // attached, so the Ctrl-F press below is a genuine no-op rather than a
    // press that merely arrived before hydration.
    const dialog = await openWithShortcut(page);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    await page.keyboard.press("Control+f");
    await expect(page.getByRole("dialog", PALETTE)).not.toBeVisible();
  });

  test("the sidebar chip advertises the new shortcut", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Search" }).getByText(/Ctrl\s*K|⌘K/)
    ).toBeVisible();
  });

  test("empty query shows the Navigate group immediately", async ({ page }) => {
    await page.goto("/");
    const dialog = await openWithShortcut(page);

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
    const dialog = await openWithShortcut(page);

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

    const dialog = page.getByRole("dialog", PALETTE);
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
    const dialog = await openWithShortcut(page);

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

  // #88: search matches ideas on the renamed `description` column, not just
  // the title — the query token here lives only in the description.
  test("finds an idea by text that only its description carries", async ({
    page,
  }) => {
    const token = `${PREFIX} ${Date.now()}`;
    const ideaTitle = `${PREFIX} Untitled capture`;
    await seedTestIdea({
      title: ideaTitle,
      description: `Publish blurb mentioning ${token}`,
    });

    await page.goto("/");
    const dialog = await openWithShortcut(page);

    await page.keyboard.type(token);

    await expect(dialog.getByText(ideaTitle)).toBeVisible();
    await expect(dialog.getByText("Content · Idea")).toBeVisible();
  });
});
