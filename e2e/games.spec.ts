import { expect, test, type Page } from "@playwright/test";

import { clearTestIdeas, seedTestIdea } from "./support/ideas-db";
import { clearTestStreams } from "./support/streams-db";
import {
  clearTestGames,
  countTestGames,
  getTestIdeaGameId,
  getTestStreamGameId,
  seedTestGame,
  setTestIdeaGame,
} from "./support/games-db";

// The games library and every surface that shows a game query the database on
// every render, so — like the ideas/streams suites — this only runs where
// DATABASE_URL is available (local dev or a Vercel preview), not in CI (see
// docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping game library DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

// One prefix set per describe block: the blocks run in parallel across
// workers, so a shared prefix would let one block's `afterEach` cleanup delete
// fixtures another block is still asserting on.
const LIB = {
  game: "[e2e-game-lib]",
  idea: "[e2e-game-lib-idea]",
};
const TAG = {
  game: "[e2e-game-tag]",
  idea: "[e2e-game-tag-idea]",
};
const FILTER = {
  game: "[e2e-game-filter]",
  idea: "[e2e-game-filter-idea]",
};
const STREAM = {
  game: "[e2e-game-stream]",
  stream: "[e2e-game-stream-s]",
};
const MOBILE = {
  game: "[e2e-game-mob]",
  idea: "[e2e-game-mob-idea]",
};

const IDEA_CARD_SELECTOR = '[data-slot="idea-card"]';
const STREAM_CARD_SELECTOR = '[data-slot="stream-card"]';

const PICKER_POPUP_SELECTOR = '[data-slot="game-picker-popup"]';

/**
 * The picker's popup, portalled to the body. Every option lookup goes through
 * this rather than the page: the ideas list renders a *filter* chip per game
 * behind the dialog, so a bare `getByText(name)` would be ambiguous.
 */
function picker(page: Page) {
  return page.locator(PICKER_POPUP_SELECTOR);
}

test.describe("game library", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await clearTestIdeas(LIB.idea);
    await clearTestGames(LIB.game);
  });

  test.afterEach(async () => {
    await clearTestIdeas(LIB.idea);
    await clearTestGames(LIB.game);
  });

  test("adds a game, renames it, and the rename shows wherever it's used", async ({
    page,
  }) => {
    const name = `${LIB.game} Path of Exile`;
    const renamed = `${LIB.game} Path of Exile 2`;
    const ideaTitle = `${LIB.idea} League start guide`;
    const gameId = await seedTestGame(name);
    await seedTestIdea({ title: ideaTitle });
    await setTestIdeaGame(ideaTitle, gameId);

    // The old spelling is what the idea card shows before the rename.
    await page.goto("/content/ideas");
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: ideaTitle }).getByText(name)
    ).toBeVisible();

    await page.goto("/content/games");
    await page.getByRole("button", { name: `Rename "${name}"` }).click();
    const field = page.getByLabel(`Rename "${name}"`);
    await field.fill(renamed);
    await field.press("Enter");
    await expect(page.getByText(renamed)).toBeVisible({ timeout: 10000 });

    // Renaming propagates because the idea points at the game by id — there is
    // no old spelling left behind anywhere.
    await page.goto("/content/ideas");
    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: ideaTitle });
    await expect(card.getByText(renamed)).toBeVisible();
    await expect(card.getByText(name, { exact: true })).toHaveCount(0);
  });

  test("adding a game that already exists selects it instead of duplicating", async ({
    page,
  }) => {
    const name = `${LIB.game} Hades`;
    await seedTestGame(name);

    await page.goto("/content/games");
    // Same name, different casing and padding — the library must stay at one.
    await page.getByLabel("Add a game").fill(`  ${name.toUpperCase()}  `);
    await page.getByRole("button", { name: "Add" }).click();

    // One entry, not two, whatever the casing and padding.
    await expect.poll(() => countTestGames(name), { timeout: 10_000 }).toBe(1);
    await page.reload();
    await expect(
      page.locator('[data-slot="game-row"]', { hasText: name })
    ).toHaveCount(1);
  });

  test("deleting a game in use warns, then untags rather than deleting the work", async ({
    page,
  }) => {
    const name = `${LIB.game} Elden Ring`;
    const ideaTitle = `${LIB.idea} Boss order`;
    const gameId = await seedTestGame(name);
    await seedTestIdea({ title: ideaTitle });
    await setTestIdeaGame(ideaTitle, gameId);

    await page.goto("/content/games");
    await page.getByRole("button", { name: `Delete "${name}"` }).click();

    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    // It says what's about to be untagged before anything happens.
    await expect(confirm.getByText(/1 idea .*untagged/i)).toBeVisible();
    await expect(confirm.getByText(/Nothing is deleted/i)).toBeVisible();
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(confirm).not.toBeVisible({ timeout: 10000 });

    // The idea survives, just without a game.
    await expect
      .poll(() => getTestIdeaGameId(ideaTitle), { timeout: 10_000 })
      .toBeNull();
    await page.goto("/content/ideas");
    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: ideaTitle });
    await expect(card).toBeVisible();
    await expect(card.getByText(name)).toHaveCount(0);
  });
});

test.describe("tagging ideas with a game", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await clearTestIdeas(TAG.idea);
    await clearTestGames(TAG.game);
  });

  test.afterEach(async () => {
    await clearTestIdeas(TAG.idea);
    await clearTestGames(TAG.game);
  });

  test("captures an idea tagged with a game added from the picker itself", async ({
    page,
  }) => {
    const title = `${TAG.idea} Fresh league opener`;
    const name = `${TAG.game} Brand New Game`;

    await page.goto("/content/ideas");
    await page.getByRole("button", { name: "New idea" }).click();
    const dialog = page.getByRole("dialog", { name: "New idea" });
    await dialog.getByLabel("Title").fill(title);

    // The game doesn't exist yet — the picker offers to add it right here,
    // with no trip to the library page first.
    await dialog.getByRole("combobox", { name: "Game" }).click();
    await picker(page).getByLabel("Search games").fill(name);
    await picker(page).getByText(`Add “${name}”`).click();
    await expect(dialog.getByRole("combobox", { name: "Game" })).toContainText(
      name
    );

    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    await expect(card.getByText(name)).toBeVisible();
  });

  test("search reaches a game in a few keystrokes, and the game can be cleared", async ({
    page,
  }) => {
    const title = `${TAG.idea} Clearable`;
    const name = `${TAG.game} Stardew Valley`;
    const other = `${TAG.game} Terraria`;
    await seedTestGame(name);
    await seedTestGame(other);
    await seedTestIdea({ title });

    await page.goto("/content/ideas");
    const card = page.locator(IDEA_CARD_SELECTOR, { hasText: title });
    await card.getByRole("button", { name: `Edit "${title}"` }).click();
    const dialog = page.getByRole("dialog", { name: "Edit idea" });

    await dialog.getByRole("combobox", { name: "Game" }).click();
    await picker(page).getByLabel("Search games").fill("stardew");
    // Typing narrows the list rather than making you scroll it.
    await expect(picker(page).getByText(other)).toHaveCount(0);
    await picker(page).getByText(name).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await expect
      .poll(() => getTestIdeaGameId(title), { timeout: 10_000 })
      .not.toBeNull();

    // Clearing it again leaves a perfectly valid, game-less idea.
    await card.getByRole("button", { name: `Edit "${title}"` }).click();
    await dialog.getByRole("combobox", { name: "Game" }).click();
    await picker(page).getByRole("option", { name: "No game" }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await expect
      .poll(() => getTestIdeaGameId(title), { timeout: 10_000 })
      .toBeNull();
    await page.reload();
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: title })
    ).toBeVisible();
  });
});

test.describe("filtering ideas by game", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await clearTestIdeas(FILTER.idea);
    await clearTestGames(FILTER.game);
  });

  test.afterEach(async () => {
    await clearTestIdeas(FILTER.idea);
    await clearTestGames(FILTER.game);
  });

  test("filters by game alone, composes with other filters, and survives a reload", async ({
    page,
  }) => {
    const name = `${FILTER.game} Hollow Knight`;
    const tagged = `${FILTER.idea} Charm build guide`;
    const taggedStream = `${FILTER.idea} Charm build stream`;
    const untagged = `${FILTER.idea} Something else entirely`;
    const gameId = await seedTestGame(name);
    await seedTestIdea({ title: tagged, format: "video" });
    await seedTestIdea({ title: taggedStream, format: "stream" });
    await seedTestIdea({ title: untagged, format: "video" });
    await setTestIdeaGame(tagged, gameId);
    await setTestIdeaGame(taggedStream, gameId);

    await page.goto("/content/ideas");
    await page
      .getByRole("group", { name: "Filter by game" })
      .getByRole("button", { name })
      .click();

    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: tagged })
    ).toBeVisible();
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: untagged })
    ).toHaveCount(0);

    // Composes with the format filter rather than replacing it.
    await page
      .getByRole("group", { name: "Filter by format" })
      .getByRole("button", { name: "Video" })
      .click();
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: tagged })
    ).toBeVisible();
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: taggedStream })
    ).toHaveCount(0);
    await expect(page).toHaveURL(/game=/);
    await expect(page).toHaveURL(/format=video/);

    // Same as every other filter: the view is in the URL, so a reload keeps it.
    await page.reload();
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: tagged })
    ).toBeVisible();
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: taggedStream })
    ).toHaveCount(0);
    await expect(
      page.locator(IDEA_CARD_SELECTOR, { hasText: untagged })
    ).toHaveCount(0);
  });
});

test.describe("tagging streams with a game", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await clearTestStreams(STREAM.stream);
    await clearTestGames(STREAM.game);
  });

  test.afterEach(async () => {
    await clearTestStreams(STREAM.stream);
    await clearTestGames(STREAM.game);
  });

  test("plans a stream tagged with a game, which shows on its card and page", async ({
    page,
  }) => {
    const title = `${STREAM.stream} League night`;
    const name = `${STREAM.game} Baldurs Gate 3`;
    await seedTestGame(name);

    await page.goto("/content/streams");
    await page.getByRole("button", { name: "New stream" }).click();
    const dialog = page.getByRole("dialog", { name: "New stream" });
    await dialog.getByLabel("Topic").fill(title);
    await dialog.getByRole("combobox", { name: "Game" }).click();
    await picker(page).getByLabel("Search games").fill("baldur");
    await picker(page).getByText(name).click();
    await expect(dialog.getByRole("combobox", { name: "Game" })).toContainText(
      name
    );
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await expect
      .poll(() => getTestStreamGameId(title), { timeout: 10_000 })
      .not.toBeNull();

    await page.goto("/content/streams");
    const card = page.locator(STREAM_CARD_SELECTOR, { hasText: title });
    await expect(card.getByText(name)).toBeVisible();

    // And on the stream's own page, where it can be changed.
    await card.click();
    await expect(page.getByRole("combobox", { name: "Game" })).toContainText(
      name
    );
  });

  test("clears a stream's game from its detail page", async ({ page }) => {
    const title = `${STREAM.stream} Untaggable`;
    const name = `${STREAM.game} Celeste`;
    await seedTestGame(name);

    await page.goto("/content/streams");
    await page.getByRole("button", { name: "New stream" }).click();
    const dialog = page.getByRole("dialog", { name: "New stream" });
    await dialog.getByLabel("Topic").fill(title);
    await dialog.getByRole("combobox", { name: "Game" }).click();
    await picker(page).getByLabel("Search games").fill("celeste");
    await picker(page).getByText(name).click();
    // Gate on the selection landing before Save: the popup is still animating
    // out over the footer for a frame or two.
    await expect(dialog.getByRole("combobox", { name: "Game" })).toContainText(
      name
    );
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await page.goto("/content/streams");
    await page.locator(STREAM_CARD_SELECTOR, { hasText: title }).click();
    await page.getByRole("combobox", { name: "Game" }).click();
    await picker(page).getByRole("option", { name: "No game" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect
      .poll(() => getTestStreamGameId(title), { timeout: 10_000 })
      .toBeNull();
  });
});

test.describe("game picker on a phone viewport", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async () => {
    await clearTestIdeas(MOBILE.idea);
    await clearTestGames(MOBILE.game);
  });

  test.afterEach(async () => {
    await clearTestIdeas(MOBILE.idea);
    await clearTestGames(MOBILE.game);
  });

  test("is reachable one-handed: open, search, add, select", async ({
    page,
  }) => {
    const title = `${MOBILE.idea} Mobile capture`;
    const name = `${MOBILE.game} Mobile Only Game`;

    await page.goto("/content/ideas");
    await page.getByRole("button", { name: "New idea" }).click();
    const dialog = page.getByRole("dialog", { name: "New idea" });
    await dialog.getByLabel("Title").fill(title);

    const trigger = dialog.getByRole("combobox", { name: "Game" });
    await expect(trigger).toBeVisible();
    await trigger.click();

    // The search field takes focus on open, so the keyboard is already up.
    const search = picker(page).getByLabel("Search games");
    await expect(search).toBeFocused();
    await search.fill(name);

    // The "add it" affordance is a real tap target, not a hover-only control —
    // measured on the option row itself, not the label span inside it.
    const add = picker(page).getByRole("option", { name: `Add “${name}”` });
    const box = await add.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);
    await add.click();

    await expect(trigger).toContainText(name);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await expect
      .poll(() => getTestIdeaGameId(title), { timeout: 10_000 })
      .not.toBeNull();
  });
});
