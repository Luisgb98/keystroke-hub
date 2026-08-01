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

/**
 * A realistic 400-plus-line Markdown script — the paste that used to stretch
 * the capture dialog to thousands of pixels (#93).
 */
const LONG_SCRIPT = [
  "# Cold open",
  "",
  "Hook them in the first five seconds.",
  "",
  "## The run",
  "",
  ...Array.from(
    { length: 400 },
    (_, i) => `- Beat ${i + 1}: what happens on screen, and the line over it.`
  ),
  "",
  "## Outro",
  "",
  "Ask for the subscribe.",
].join("\n");

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

  test("captures full input — description, format, and tags all render", async ({
    page,
  }) => {
    const title = `${PREFIX} Glitch tutorial`;
    await page.goto("/content/ideas");

    await page.getByRole("button", { name: "New idea" }).click();
    const dialog = page.getByRole("dialog", { name: "New idea" });
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByRole("radio", { name: "Video" }).click();
    await dialog.getByLabel("Description").fill("Cover the wrong warp");
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

// #93: the capture dialog is a capture surface, not the script editor. A
// pasted script has to fit inside it without pushing every other field off
// screen — and still reach the database untouched.
test.describe("idea capture with a pasted script", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-idea-script]";

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("a 400-line paste leaves the dialog compact and lands byte-identical", async ({
    page,
  }) => {
    // Capture writes the idea and then a ~22KB script row — two sequential
    // round trips to a remote Neon dev DB, well past the budget the
    // short-input captures in this file need.
    test.slow();
    const title = `${PREFIX} Pasted script`;
    await page.goto("/content/ideas");

    await page.getByRole("button", { name: "New idea" }).click();
    const dialog = page.getByRole("dialog", { name: "New idea" });
    await dialog.getByLabel("Title").fill(title);

    // The dialog caps at 90dvh whatever happens, so its own box proves
    // nothing — what matters is that its *content* doesn't balloon.
    const contentHeightBefore = await dialog.evaluate((el) => el.scrollHeight);

    const script = dialog.getByLabel("Script (optional)");
    await script.fill(LONG_SCRIPT);

    const contentHeightAfter = await dialog.evaluate((el) => el.scrollHeight);
    expect(contentHeightAfter - contentHeightBefore).toBeLessThan(160);

    // The script area took the growth and scrolls inside itself instead.
    const box = await script.boundingBox();
    if (!box) throw new Error("the script field was not laid out");
    expect(box.height).toBeLessThanOrEqual(170);
    const [scrollHeight, clientHeight] = await script.evaluate((el) => [
      el.scrollHeight,
      el.clientHeight,
    ]);
    expect(scrollHeight).toBeGreaterThan(clientHeight);

    // The size indicator stands in for the text you can no longer see.
    await expect(dialog.getByText(/^[\d,]+ words$/)).toBeVisible();

    // Every other field is still there and usable.
    await expect(dialog.getByLabel("Title")).toHaveValue(title);
    await dialog.getByLabel("Tags").fill("speedrun, glitch");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 30000 });

    // Byte-identical on the other side: same newlines, no trimming.
    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    await card.getByRole("link", { name: /script for/ }).click();
    await expect(page.getByLabel("Script", { exact: true })).toHaveValue(
      LONG_SCRIPT
    );
  });

  test("expanding gives the pasted script more room without hiding the rest", async ({
    page,
  }) => {
    await page.goto("/content/ideas");
    await page.getByRole("button", { name: "New idea" }).click();
    const dialog = page.getByRole("dialog", { name: "New idea" });

    const script = dialog.getByLabel("Script (optional)");
    // A short script needs no expand control — it's already fully visible.
    await script.fill("# Intro\n\nTwo lines.");
    await expect(dialog.getByRole("button", { name: "Expand" })).toHaveCount(0);

    await script.fill(LONG_SCRIPT);
    const collapsed = (await script.boundingBox())!.height;
    await dialog.getByRole("button", { name: "Expand" }).click();
    const expanded = (await script.boundingBox())!.height;
    expect(expanded).toBeGreaterThan(collapsed);

    // Still inside the dialog, and the submit action is still reachable.
    const dialogBox = (await dialog.boundingBox())!;
    expect(expanded).toBeLessThan(dialogBox.height);
    await expect(dialog.getByRole("button", { name: "Save" })).toBeVisible();

    await dialog.getByRole("button", { name: "Collapse" }).click();
    expect((await script.boundingBox())!.height).toBeCloseTo(collapsed, 0);
  });

  test("a script over the 200,000-character cap is rejected at the field itself", async ({
    page,
  }) => {
    // 200KB over the wire before the schema can reject it.
    test.slow();
    const title = `${PREFIX} Over cap`;
    await page.goto("/content/ideas");

    await page.getByRole("button", { name: "New idea" }).click();
    const dialog = page.getByRole("dialog", { name: "New idea" });
    await dialog.getByLabel("Title").fill(title);
    await dialog.getByLabel("Script (optional)").fill("a".repeat(200_001));
    await dialog.getByRole("button", { name: "Save" }).click();

    // Before #93 the server rejected this and the dialog said only "Check the
    // highlighted fields" — with nothing highlighted.
    await expect(
      dialog.getByText(
        "That script is too long — keep it under 200,000 characters."
      )
    ).toBeVisible({ timeout: 30000 });
    await expect(dialog.getByLabel("Script (optional)")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    await expect(dialog).toBeVisible();

    // Nothing was captured.
    await page.goto(`/content/ideas?q=${encodeURIComponent(PREFIX)}`);
    await expect(page.locator(IDEA_CARD_SELECTOR)).toHaveCount(0);
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

  // #102: the release chip on the card *is* the reschedule control — shifting a
  // publish slot is the most frequent edit a content schedule takes, and it
  // used to mean a trip through the whole edit dialog.
  test("the card's release chip moves the release without opening the editor", async ({
    page,
  }) => {
    const title = `${PREFIX} Chip reschedule`;
    await page.goto("/content/ideas");

    await page.getByRole("button", { name: "New idea" }).click();
    const createDialog = page.getByRole("dialog", { name: "New idea" });
    await createDialog.getByLabel("Title").fill(title);
    await createDialog.getByLabel("Release date").fill(releaseA);
    await expect(createDialog.getByLabel("Release time")).toHaveValue("19:00");
    await createDialog.getByRole("button", { name: "Save" }).click();
    await expect(createDialog).not.toBeVisible({ timeout: 30000 });

    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    await card
      .getByRole("button", { name: /Reschedule release, currently/ })
      .click();

    // The popover portals out of the card, so these are page-level queries.
    await expect(page.getByLabel("New day")).toHaveValue(releaseA);
    await expect(page.getByLabel("New time")).toHaveValue("19:00");
    await page.getByLabel("New day").fill(releaseB);
    await page.getByLabel("New time").fill("21:00");
    await page.getByRole("button", { name: "Move release" }).click();

    // No dialog was ever opened, and the chip reflects the new slot.
    await expect(page.getByRole("dialog", { name: "Edit idea" })).toHaveCount(
      0
    );
    await expect(
      card.getByRole("button", {
        name: /Reschedule release, currently .*21:00/,
      })
    ).toBeVisible({ timeout: 10000 });

    // The move is real: the calendar event follows, and the 21:00 wall clock
    // reads back as 21:00 rather than shifting by the server's offset (#95).
    await page.goto(`/calendar?view=day&date=${releaseB}`);
    await expect(page.getByText(`Release: ${title}`)).toBeVisible();
    await page.goto(`/calendar?view=day&date=${releaseA}`);
    await expect(page.getByText(`Release: ${title}`)).toHaveCount(0);

    await page.goto("/content/ideas");
    await expect(
      page
        .locator(IDEA_CARD_SELECTOR, { hasText: title })
        .getByRole("button", { name: /Reschedule release, currently .*21:00/ })
    ).toBeVisible();
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
    await dialog.getByLabel("Description").fill("Now with a plan");
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
  const description = "First paragraph.\n\nSecond paragraph.";
  // "boss rush" carries an internal space on purpose: #94 collapses a multi-word
  // tag into one hashtag, so the clipboard proves that end to end.
  const tags = ["speedrun", "glitch", "tutorial", "retro", "boss rush"];
  // Spelled out rather than derived, so the assertion is independent of the
  // formatter it checks.
  const tagsText = "#speedrun #glitch #tutorial #retro #bossrush";

  test.beforeAll(async () => {
    await seedTestIdea({ title, description, tags });
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
    expect(await readClipboard(page)).toBe(`${description}\n\n${tagsText}`);

    await card.getByRole("button", { name: "Copy Tags", exact: true }).click();
    expect(await readClipboard(page)).toBe(tagsText);
  });

  // #88: the empty case survives the rename — an idea captured without a
  // description renders no description paragraph and can't copy that block.
  test("an idea with no description renders no paragraph and disables its copy block", async ({
    page,
  }) => {
    const bareTitle = `${PREFIX} No description`;
    await seedTestIdea({ title: bareTitle, tags });
    await page.goto(`/content/ideas?q=${encodeURIComponent(bareTitle)}`);

    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: bareTitle });
    await expect(card).toBeVisible();
    await expect(card.getByText(description)).toHaveCount(0);
    await expect(
      card.getByRole("button", { name: "Copy Description + tags", exact: true })
    ).toBeDisabled();
    // The blocks that only need tags stay copyable.
    await expect(
      card.getByRole("button", { name: "Copy Tags", exact: true })
    ).toBeEnabled();
  });
});

test.describe("uniform idea card dimensions", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-idea-uniform]";
  const shortTitle = `${PREFIX} Short one`;
  const longTitle = `${PREFIX} Long one`;

  test.beforeAll(async () => {
    await seedTestIdea({ title: shortTitle, description: "Tiny." });
    await seedTestIdea({
      title: longTitle,
      description: Array.from(
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
  // These share one title prefix, and the `afterEach` clears the whole prefix
  // — so they can't run against the DB at the same time. Same reason the
  // capture and filter describes above are serial.
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-idea-mobile]";

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("the header's 'New idea' button opens the dialog for one-handed capture", async ({
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

  test("the primary action sits in the page header, with no floating dock left (#85)", async ({
    page,
  }) => {
    await page.goto("/content/ideas");

    // "New idea" is an inline header button now, not a bottom-right FAB: it
    // sits beside the heading, in the top half of the screen.
    const newIdea = page.getByRole("button", { name: "New idea" });
    await expect(newIdea).toBeVisible();
    const heading = page.getByRole("heading", { level: 1, name: "Ideas" });
    const actionBox = await newIdea.boundingBox();
    const headingBox = await heading.boundingBox();
    expect(actionBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    const viewport = page.viewportSize();
    expect(actionBox!.y).toBeLessThan(viewport!.height / 2);
    // Roughly on the heading's row, rather than floating far below it.
    expect(Math.abs(actionBox!.y - headingBox!.y)).toBeLessThan(80);

    // Nothing floats in the corner any more: no capture "+", and the only
    // Inbox link is the nav's.
    await expect(
      page.getByRole("button", { name: "Capture a thought" })
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Inbox/ })).toHaveCount(1);
  });

  // #93: on a 812px-tall screen the dialog only has 90dvh to work with, so a
  // pasted script must take its cap and leave the rest of the form usable.
  test("a pasted script stays capped and doesn't squeeze the other fields", async ({
    page,
  }) => {
    // See the desktop paste test: the ~22KB script row makes this save slower
    // than the short-input captures around it.
    test.slow();
    const title = `${PREFIX} Pasted script`;
    await page.goto("/content/ideas");

    await page.getByRole("button", { name: "New idea" }).click();
    const dialog = page.getByRole("dialog", { name: "New idea" });
    await dialog.getByLabel("Title").fill(title);

    const script = dialog.getByLabel("Script (optional)");
    await script.fill(LONG_SCRIPT);

    const viewport = page.viewportSize()!;
    const dialogBox = (await dialog.boundingBox())!;
    expect(dialogBox.height).toBeLessThanOrEqual(viewport.height * 0.9 + 1);

    const scriptBox = (await script.boundingBox())!;
    expect(scriptBox.height).toBeLessThanOrEqual(170);
    // A quarter of the dialog at most — the title, format, tags and release
    // rows keep the rest.
    expect(scriptBox.height).toBeLessThan(dialogBox.height / 3);

    // Touch-scrolling inside the script must not chain out to the dialog's
    // own `overflow-y-auto` body.
    await expect(script).toHaveCSS("overscroll-behavior-y", "contain");

    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 30000 });
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: title })
    ).toBeVisible();
  });

  test("copy buttons are comfortable tap targets", async ({ page }) => {
    const title = `${PREFIX} Copy targets`;
    await seedTestIdea({
      title,
      description: "Body",
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
