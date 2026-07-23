import { expect, test, type Page } from "@playwright/test";

import { clearTestIdeas, seedTestIdea } from "./support/ideas-db";

// The detail page queries the database on every render, so — like the ideas
// list, board, and script page — it can only be exercised where DATABASE_URL
// is available (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping idea-detail DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const IDEA_CARD_SELECTOR = '[data-slot="idea-card"]';

/** Navigates from the ideas list to an idea's detail page via its card title. */
async function openDetail(page: Page, title: string) {
  await page.goto("/content/ideas");
  const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
  await card.getByRole("link", { name: title, exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: title })
  ).toBeVisible();
}

test.describe("idea detail page", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-idea-detail]";

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("clicking a card opens the idea's full detail page", async ({
    page,
  }) => {
    const title = `${PREFIX} Wrong warp tutorial`;
    await seedTestIdea({
      title,
      notes: "Cover the credits warp",
      format: "video",
      status: "scripted",
      tags: ["speedrun", "glitch"],
    });

    await openDetail(page, title);

    await expect(page.getByText("Cover the credits warp")).toBeVisible();
    await expect(page.getByText("Video")).toBeVisible();
    await expect(page.getByText("speedrun")).toBeVisible();
    await expect(page.getByText("glitch", { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Status" })).toContainText(
      "Scripted"
    );
  });

  test("exposes the four publish copy blocks", async ({ page }) => {
    const title = `${PREFIX} Copy blocks`;
    await seedTestIdea({ title, tags: ["a", "b", "c", "d", "e"] });

    await openDetail(page, title);

    for (const name of [
      "Copy Title",
      "Copy Title + tags",
      "Copy Description + tags",
      "Copy Tags",
    ]) {
      await expect(
        page.getByRole("button", { name, exact: true })
      ).toBeVisible();
    }
  });

  test("script reads by default and edits only when asked", async ({
    page,
  }) => {
    const title = `${PREFIX} Read then edit`;
    await seedTestIdea({ title });
    await openDetail(page, title);

    // Read-only by default: no write surface, an explicit Edit control.
    await expect(page.getByLabel("Script", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Edit", exact: true })
    ).toBeVisible();

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByLabel("Script", { exact: true })
      .fill("# Cold open\n\nHook them fast.");
    await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible({
      timeout: 10000,
    });

    // Leaving edit mode returns to the rendered view; editing chrome is gone.
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByLabel("Script", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 1, name: "Cold open" })
    ).toBeVisible();

    // The rendered script survives a reload, still in read mode.
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Cold open" })
    ).toBeVisible();
    await expect(page.getByLabel("Script", { exact: true })).toHaveCount(0);
  });

  test("visiting a nonexistent idea shows the not-found page", async ({
    page,
  }) => {
    // Not a literal 404 status: this route has a `loading.tsx`, so the response
    // starts streaming (200) before `notFound()` resolves — the same documented
    // Next.js tradeoff as the script page (see docs/scripts.md). The
    // `notFound()` UI is what's asserted.
    await page.goto("/content/ideas/00000000-0000-0000-0000-000000000000");
    await expect(
      page.getByRole("heading", { name: "This page could not be found." })
    ).toBeVisible();
  });
});

test.describe("idea detail mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  const PREFIX = "[e2e-idea-detail-mobile]";

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("a long script reads comfortably with no horizontal overflow", async ({
    page,
  }) => {
    const title = `${PREFIX} Long script`;
    await seedTestIdea({ title });
    await openDetail(page, title);

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const longScript = Array.from(
      { length: 400 },
      (_, i) => `Line ${i}: the wrong warp trick sets up the boss skip.`
    ).join("\n");
    await page.getByLabel("Script", { exact: true }).fill(longScript);
    await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText(/wrong warp trick/).first()).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
