import { expect, test } from "@playwright/test";

import { formatDateParam } from "../lib/calendar/range";
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
    await expect(card.getByRole("combobox", { name: "Status" })).toContainText(
      "Idea"
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
    // The status control is the themed shadcn `Select` (#72) — a combobox with
    // a portalled option list, not a native `<select>`.
    await card.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Scripted" }).click();
    await expect(card.getByRole("combobox", { name: "Status" })).toContainText(
      "Scripted"
    );

    await page.reload();
    await expect(
      page
        .locator(IDEA_CARD_SELECTOR, { hasText: title })
        .getByRole("combobox", { name: "Status" })
    ).toContainText("Scripted");
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
      status: "scripted",
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
      .getByRole("button", { name: "Scripted" })
      .click();

    await expect(page).toHaveURL(/status=scripted/);
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

test.describe("idea release scheduling and editing", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-idea-release]";

  // Two comfortably-future dates so the release lands on an unambiguous,
  // otherwise-empty calendar day regardless of when the suite runs.
  const dateParamOffsetDays = (offset: number): string => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return formatDateParam(date);
  };
  const releaseA = dateParamOffsetDays(30);
  const releaseB = dateParamOffsetDays(45);

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("a captured release date lands on the content calendar at 19:00", async ({
    page,
  }) => {
    const title = `${PREFIX} Scheduled reveal`;
    await page.goto("/content/ideas");

    await page.getByRole("button", { name: "New idea" }).click();
    const dialog = page.getByRole("dialog", { name: "New idea" });
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByLabel("Release date").fill(releaseA);
    // The time defaults to the channel's standard 19:00 publish slot.
    await expect(dialog.getByLabel("Release time")).toHaveValue("19:00");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.goto(`/calendar?view=day&date=${releaseA}`);
    await expect(page.getByText(`Release: ${title}`)).toBeVisible();
  });

  test("changing the release date moves the calendar event; clearing it removes the event", async ({
    page,
  }) => {
    const title = `${PREFIX} Movable release`;
    await page.goto("/content/ideas");

    await page.getByRole("button", { name: "New idea" }).click();
    const createDialog = page.getByRole("dialog", { name: "New idea" });
    await createDialog.getByLabel("Title").fill(title);
    await createDialog.getByLabel("Release date").fill(releaseA);
    await createDialog.getByRole("button", { name: "Save" }).click();
    await expect(createDialog).not.toBeVisible({ timeout: 10000 });

    // Move the release to a later date.
    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    await card.getByRole("button", { name: `Edit "${title}"` }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit idea" });
    await editDialog.getByLabel("Release date").fill(releaseB);
    await editDialog.getByRole("button", { name: "Save" }).click();
    await expect(editDialog).not.toBeVisible({ timeout: 10000 });

    await page.goto(`/calendar?view=day&date=${releaseB}`);
    await expect(page.getByText(`Release: ${title}`)).toBeVisible();
    await page.goto(`/calendar?view=day&date=${releaseA}`);
    await expect(page.getByText(`Release: ${title}`)).toHaveCount(0);

    // Clear the release entirely.
    await page.goto("/content/ideas");
    await card.getByRole("button", { name: `Edit "${title}"` }).click();
    await expect(editDialog).toBeVisible();
    await editDialog.getByRole("button", { name: "Clear" }).click();
    await editDialog.getByRole("button", { name: "Save" }).click();
    await expect(editDialog).not.toBeVisible({ timeout: 10000 });

    await page.goto(`/calendar?view=day&date=${releaseB}`);
    await expect(page.getByText(`Release: ${title}`)).toHaveCount(0);
  });

  test("every field is editable after capture and the changes survive a reload", async ({
    page,
  }) => {
    const title = `${PREFIX} Editable idea`;
    await seedTestIdea({ title, format: "either" });
    await page.goto("/content/ideas");

    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    await card.getByRole("button", { name: `Edit "${title}"` }).click();
    const dialog = page.getByRole("dialog", { name: "Edit idea" });
    await dialog.getByRole("radio", { name: "Video" }).click();
    await dialog.getByLabel("Notes").fill("Now with a plan");
    await dialog.getByLabel("Tags").fill("speedrun, glitch, tutorial");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await expect(card.getByText("Video")).toBeVisible();
    await expect(card.getByText("Now with a plan")).toBeVisible();

    await page.reload();
    const reloaded = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    await expect(reloaded.getByText("Video")).toBeVisible();
    await expect(reloaded.getByText("tutorial", { exact: true })).toBeVisible();
  });

  test("the tag field counts toward the five-tag publishing standard", async ({
    page,
  }) => {
    await page.goto("/content/ideas");
    await page.getByRole("button", { name: "New idea" }).click();
    const dialog = page.getByRole("dialog", { name: "New idea" });

    await expect(dialog.getByText("0/5")).toBeVisible();
    await dialog.getByLabel("Tags").fill("a, b, c, d, e");
    await expect(dialog.getByText("5/5")).toBeVisible();
    await dialog.getByLabel("Tags").fill("a, b, c, d, e, f");
    await expect(dialog.getByText("6/5")).toBeVisible();
  });
});

test.describe("idea publish copy blocks", () => {
  // Clipboard access is origin-scoped and off by default under automation.
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-idea-copy]";
  const title = `${PREFIX} Publish ready`;
  const notes = "First paragraph.\n\nSecond paragraph.";
  const tags = ["speedrun", "glitch", "tutorial", "retro", "movement"];
  const tagsText = tags.join(", ");

  test.beforeAll(async () => {
    await seedTestIdea({ title, notes, tags });
  });

  test.afterAll(async () => {
    await clearTestIdeas(PREFIX);
  });

  async function readClipboard(page: import("@playwright/test").Page) {
    return page.evaluate(() => navigator.clipboard.readText());
  }

  test("each copy button hands over its exact publish block, line breaks intact", async ({
    page,
  }) => {
    await page.goto(`/content/ideas?q=${encodeURIComponent(PREFIX)}`);
    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    await expect(card).toBeVisible();

    // `exact` matters: "Copy Title" is a substring of "Copy Title + tags",
    // and "Copy Tags" of nothing — Playwright's name match is substring by
    // default, so pin each to its full accessible name.
    await card.getByRole("button", { name: "Copy Title", exact: true }).click();
    expect(await readClipboard(page)).toBe(title);

    await card
      .getByRole("button", { name: "Copy Title + tags", exact: true })
      .click();
    expect(await readClipboard(page)).toBe(`${title}\n\n${tagsText}`);

    await card
      .getByRole("button", { name: "Copy Description + tags", exact: true })
      .click();
    expect(await readClipboard(page)).toBe(`${notes}\n\n${tagsText}`);

    await card.getByRole("button", { name: "Copy Tags", exact: true }).click();
    expect(await readClipboard(page)).toBe(tagsText);
  });
});

test.describe("uniform idea card dimensions", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-idea-uniform]";
  const shortTitle = `${PREFIX} Short one`;
  const longTitle = `${PREFIX} Long one`;

  test.beforeAll(async () => {
    await seedTestIdea({ title: shortTitle, notes: "Tiny." });
    await seedTestIdea({
      title: longTitle,
      notes: Array.from(
        { length: 12 },
        (_, i) =>
          `Paragraph ${i + 1} with plenty of detail that would otherwise stretch this card well past its neighbour.`
      ).join("\n\n"),
      tags: ["a", "b", "c", "d", "e"],
    });
  });

  test.afterAll(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("a long description does not make its card taller than a short one", async ({
    page,
  }) => {
    // Filter to just this suite's two ideas so they share the same grid row —
    // `auto-rows-fr` then equalizes their height, and equal height proves the
    // description length never stretches the card.
    await page.goto(`/content/ideas?q=${encodeURIComponent(PREFIX)}`);
    const shortCard = page.locator(IDEA_CARD_SELECTOR, { hasText: shortTitle });
    const longCard = page.locator(IDEA_CARD_SELECTOR, { hasText: longTitle });
    await expect(shortCard).toBeVisible();
    await expect(longCard).toBeVisible();

    const shortBox = await shortCard.boundingBox();
    const longBox = await longCard.boundingBox();
    if (!shortBox || !longBox) throw new Error("cards were not laid out");

    expect(Math.abs(shortBox.height - longBox.height)).toBeLessThan(1);
    expect(Math.abs(shortBox.width - longBox.width)).toBeLessThan(1);
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

  test("shows a single primary floating action with no overlapping controls", async ({
    page,
  }) => {
    await page.goto("/content/ideas");

    // The page action replaces the global capture "+" by design (Issue #74) —
    // they are swapped, never stacked. So on a content screen there is exactly
    // one primary FAB ("New idea") and no separate "Capture a thought" button.
    const newIdea = page.getByRole("button", { name: "New idea" });
    await expect(newIdea).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Capture a thought" })
    ).toHaveCount(0);

    // The Inbox pill sits above the primary action without touching it.
    const inbox = page.getByRole("link", { name: /Inbox/ });
    await expect(inbox).toBeVisible();
    const inboxBox = await inbox.boundingBox();
    const actionBox = await newIdea.boundingBox();
    expect(inboxBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    // Inbox is fully above the action — bottom edge does not reach its top.
    expect(inboxBox!.y + inboxBox!.height).toBeLessThanOrEqual(actionBox!.y);
  });

  test("copy buttons are comfortable tap targets", async ({ page }) => {
    const title = `${PREFIX} Copy targets`;
    await seedTestIdea({
      title,
      notes: "Body",
      tags: ["a", "b", "c", "d", "e"],
    });
    await page.goto(`/content/ideas?q=${encodeURIComponent(PREFIX)}`);

    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    const copyButton = card.getByRole("button", {
      name: "Copy Title",
      exact: true,
    });
    await expect(copyButton).toBeVisible();

    const box = await copyButton.boundingBox();
    if (!box) throw new Error("copy button was not laid out");
    expect(box.height).toBeGreaterThanOrEqual(36);
  });
});
