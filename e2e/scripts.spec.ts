import { expect, test } from "@playwright/test";

import { clearTestIdeas, seedTestIdea } from "./support/ideas-db";

// The script page queries the database on every render, so — like the ideas
// list and board — it can only be exercised where DATABASE_URL is available
// (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping script DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const IDEA_CARD_SELECTOR = '[data-slot="idea-card"]';

/** Navigates from the ideas list to a given idea's script page via its card action. */
async function openScript(
  page: import("@playwright/test").Page,
  title: string
) {
  await page.goto("/content/ideas");
  const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
  await card.getByRole("link", { name: /script for/ }).click();
  await expect(page.getByLabel("Script", { exact: true })).toBeVisible();
}

test.describe("script editor", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-script]";

  // A script row cascades away with its idea (`on delete cascade`), so
  // clearing the seeded ideas is enough cleanup.
  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("writing autosaves, and the content survives a reload", async ({
    page,
  }) => {
    const title = `${PREFIX} Autosave test`;
    await seedTestIdea({ title });
    await openScript(page, title);

    await page
      .getByLabel("Script", { exact: true })
      .fill("# Cold open\n\nHook them fast.");
    await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible({
      timeout: 10000,
    });

    await page.reload();
    await expect(page.getByLabel("Script", { exact: true })).toHaveValue(
      "# Cold open\n\nHook them fast."
    );
  });

  test("the Save button commits immediately, without waiting for autosave", async ({
    page,
  }) => {
    const title = `${PREFIX} Explicit save`;
    await seedTestIdea({ title });
    await openScript(page, title);

    await page.getByLabel("Script", { exact: true }).fill("Quick save");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible({
      timeout: 10000,
    });
  });

  test("Read mode renders the script, visually distinct from Write, and the mode survives a reload", async ({
    page,
  }) => {
    const title = `${PREFIX} Read mode`;
    await seedTestIdea({ title });
    await openScript(page, title);

    await page
      .getByLabel("Script", { exact: true })
      .fill("# Heading\n\nBody text.");
    await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("tab", { name: "Read" }).click();
    await expect(page.getByRole("heading", { name: "Heading" })).toBeVisible();
    await expect(page.getByLabel("Script", { exact: true })).not.toBeVisible();
    await expect(page).toHaveURL(/view=read/);

    await page.reload();
    await expect(page.getByRole("heading", { name: "Heading" })).toBeVisible();
  });

  test("the card's script action opens straight into a saved script, labeled 'Open'", async ({
    page,
  }) => {
    const title = `${PREFIX} Reopen`;
    await seedTestIdea({ title });
    await openScript(page, title);
    await page.getByLabel("Script", { exact: true }).fill("Already written");
    await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible({
      timeout: 10000,
    });

    await page.goto("/content/ideas");
    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    await expect(
      card.getByRole("link", { name: `Open script for "${title}"` })
    ).toBeVisible();
  });

  test("visiting a script for a nonexistent idea shows the not-found page", async ({
    page,
  }) => {
    // Not a literal 404 status: this route has a `loading.tsx`, so the
    // response starts streaming (200) before `notFound()` resolves — a
    // documented Next.js tradeoff (see the Status Codes note in
    // `node_modules/next/dist/docs/.../loading.md`) that's fine for a
    // private, unindexed single-user app. The `notFound()` UI itself is
    // still what's asserted here.
    await page.goto(
      "/content/ideas/00000000-0000-0000-0000-000000000000/script"
    );
    await expect(
      page.getByRole("heading", { name: "This page could not be found." })
    ).toBeVisible();
  });
});

test.describe("script editor mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  const PREFIX = "[e2e-script-mobile]";

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("a long script stays editable and readable, with no horizontal overflow", async ({
    page,
  }) => {
    const title = `${PREFIX} Long script`;
    await seedTestIdea({ title });
    await openScript(page, title);

    const longScript = Array.from(
      { length: 400 },
      (_, i) => `Line ${i}: the wrong warp trick sets up the boss skip.`
    ).join("\n");
    await page.getByLabel("Script", { exact: true }).fill(longScript);
    await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible({
      timeout: 10000,
    });

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    await page.getByRole("tab", { name: "Read" }).click();
    await expect(page.getByText(/wrong warp trick/).first()).toBeVisible();
  });
});
