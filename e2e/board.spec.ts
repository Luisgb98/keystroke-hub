import { expect, test, type Page } from "@playwright/test";

import { clearTestIdeas, seedTestIdea } from "./support/ideas-db";

// The board page queries the database on every render, so — like the ideas
// list and calendar — it can only be exercised where DATABASE_URL is
// available (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping board DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const BOARD_CARD_SELECTOR = '[data-slot="board-card"]';

/** The stage column whose header matches `label` — disambiguates from the move menu, which lists the same stage names. */
function column(page: Page, label: string) {
  return page
    .locator('[data-slot="stage-column"]')
    .filter({ has: page.getByRole("heading", { name: label, exact: true }) });
}

const DRAG_PREVIEW_SELECTOR = '[data-slot="board-drag-preview"]';

async function moveCard(page: Page, title: string, targetStatusLabel: string) {
  const card = page.locator(BOARD_CARD_SELECTOR, { hasText: title });
  await card.getByRole("button", { name: `Move "${title}"` }).click();
  await page.getByRole("menuitem", { name: targetStatusLabel }).click();
}

/** Centre of a locator's box, in the viewport coordinates page.mouse works in. */
async function centerOf(locator: ReturnType<Page["locator"]>) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Mouse-drags a card into another column.
 *
 * Always drag between *adjacent* columns: `page.mouse` works in raw viewport
 * coordinates and never auto-scrolls, and the board deliberately has no
 * drag-edge auto-scroll (same deferral as the calendar, see docs/calendar.md),
 * so a target three columns away can only be reached by scrolling the source
 * card out of the viewport first. The target is scrolled into the horizontal
 * scrollport before either box is measured, since a card's box moves when the
 * board scrolls.
 *
 * `aim: "shelf"` drops near the column's bottom edge — blank shelf rather than
 * a card — which is the same geometry an empty column's placeholder occupies.
 * `hold` leaves the card airborne for the caller to inspect (or abandon).
 */
async function dragCardToColumn(
  page: Page,
  title: string,
  targetStatusLabel: string,
  {
    hold = false,
    aim = "center",
  }: { hold?: boolean; aim?: "center" | "shelf" } = {}
) {
  const target = column(page, targetStatusLabel);
  await target.scrollIntoViewIfNeeded();

  const card = page.locator(BOARD_CARD_SELECTOR, { hasText: title });
  const grip = card.locator('[data-slot="board-card-grip"]');
  const from = await centerOf(grip);
  const targetBox = (await target.boundingBox())!;
  const to = {
    x: targetBox.x + targetBox.width / 2,
    y:
      aim === "shelf"
        ? targetBox.y + targetBox.height - 16
        : targetBox.y + targetBox.height / 2,
  };

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // Cross DRAG_THRESHOLD_PX first so the gesture engages before it travels.
  await page.mouse.move(from.x + 12, from.y, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await expect(page.locator(DRAG_PREVIEW_SELECTOR)).toBeVisible();
  await expect(target).toHaveAttribute("data-drop-target", "true");
  if (hold) return;
  await page.mouse.up();
}

/**
 * Whether the page would let a touch scroll right now: the gesture blocks
 * `touchmove` only while a card is airborne, so this is the scroll-vs-drag
 * contract, read directly rather than inferred from a scroll offset (synthetic
 * pointer events can't drive real panning).
 */
async function touchScrollingIsAllowed(page: Page) {
  return page.evaluate(() => {
    const probe = new Event("touchmove", { bubbles: true, cancelable: true });
    window.dispatchEvent(probe);
    return !probe.defaultPrevented;
  });
}

/**
 * A touch lift: press, wait past LONG_PRESS_MS, then drag. Playwright has no
 * "hold, then drag" touch primitive, so this synthesizes the same pointer
 * events a real long-press produces — the recipe from
 * `e2e/drag-reschedule.spec.ts`'s mobile block.
 */
async function touchDragCardToColumn(
  page: Page,
  title: string,
  targetStatusLabel: string
) {
  const target = column(page, targetStatusLabel);
  await target.scrollIntoViewIfNeeded();

  const card = page.locator(BOARD_CARD_SELECTOR, { hasText: title });
  const from = await centerOf(card.locator('[data-slot="board-card-grip"]'));
  const to = await centerOf(target);

  await card.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    clientX: from.x,
    clientY: from.y,
    bubbles: true,
  });
  await page.waitForTimeout(450); // past LONG_PRESS_MS
  await expect(page.locator(DRAG_PREVIEW_SELECTOR)).toBeVisible();
  // Airborne: the board must not pan under the finger any more.
  expect(await touchScrollingIsAllowed(page)).toBe(false);

  await page.dispatchEvent("body", "pointermove", {
    pointerId: 1,
    pointerType: "touch",
    clientX: to.x,
    clientY: to.y,
    bubbles: true,
  });
  await page.dispatchEvent("body", "pointerup", {
    pointerId: 1,
    pointerType: "touch",
    clientX: to.x,
    clientY: to.y,
    bubbles: true,
  });
}

test.describe("content pipeline board", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-board]";

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("each idea renders in the column matching its stage", async ({
    page,
  }) => {
    const scriptedTitle = `${PREFIX} Scripted idea`;
    const editedTitle = `${PREFIX} Edited idea`;
    await seedTestIdea({ title: scriptedTitle, status: "scripted" });
    await seedTestIdea({ title: editedTitle, status: "edited" });

    await page.goto("/content/board");

    await expect(
      column(page, "Scripted").getByText(scriptedTitle)
    ).toBeVisible();
    await expect(column(page, "Edited").getByText(editedTitle)).toBeVisible();
    await expect(column(page, "Edited").getByText(scriptedTitle)).toHaveCount(
      0
    );
  });

  test("moving a card via the menu updates its column and survives a reload", async ({
    page,
  }) => {
    const title = `${PREFIX} Move me`;
    await seedTestIdea({ title, status: "scripted" });
    await page.goto("/content/board");

    await moveCard(page, title, "Recorded");

    await expect(column(page, "Recorded").getByText(title)).toBeVisible();
    await expect(column(page, "Scripted").getByText(title)).toHaveCount(0);

    await page.reload();
    await expect(column(page, "Recorded").getByText(title)).toBeVisible();
  });

  test("shows exactly the five pipeline columns", async ({ page }) => {
    await page.goto("/content/board");

    await expect(page.locator('[data-slot="stage-column"]')).toHaveCount(5);
    for (const label of [
      "Idea",
      "Scripted",
      "Recorded",
      "Edited",
      "Published",
    ]) {
      await expect(column(page, label)).toBeVisible();
    }
    for (const removed of ["Spark", "Outlined", "Parked"]) {
      await expect(column(page, removed)).toHaveCount(0);
    }
  });

  test("a new idea starts in the Idea column and moves forward through the pipeline", async ({
    page,
  }) => {
    const title = `${PREFIX} Fresh idea`;
    await seedTestIdea({ title });
    await page.goto("/content/board");

    await expect(column(page, "Idea").getByText(title)).toBeVisible();

    await moveCard(page, title, "Scripted");
    await expect(column(page, "Scripted").getByText(title)).toBeVisible();
    await expect(column(page, "Idea").getByText(title)).toHaveCount(0);
  });

  test("dragging a card into another column moves it and survives a reload", async ({
    page,
  }) => {
    const title = `${PREFIX} Drag me`;
    await seedTestIdea({ title, status: "scripted" });
    await page.goto("/content/board");

    await dragCardToColumn(page, title, "Recorded");

    await expect(column(page, "Recorded").getByText(title)).toBeVisible();
    await expect(column(page, "Scripted").getByText(title)).toHaveCount(0);
    await expect(page.locator(DRAG_PREVIEW_SELECTOR)).toHaveCount(0);

    await page.reload();
    await expect(column(page, "Recorded").getByText(title)).toBeVisible();
  });

  test("dropping on a column's blank shelf moves the card there too", async ({
    page,
  }) => {
    const title = `${PREFIX} Onto the shelf`;
    await seedTestIdea({ title, status: "recorded" });
    await page.goto("/content/board");

    // The whole column box is the drop target, not just the cards in it —
    // which is the same mechanism that makes an *empty* column droppable. The
    // literal empty-column case is asserted in the unit suites instead: this
    // spec runs against a real database whose columns can't be guaranteed
    // empty (see docs/content-ideas.md).
    await dragCardToColumn(page, title, "Edited", { aim: "shelf" });

    await expect(column(page, "Edited").getByText(title)).toBeVisible();
    await page.reload();
    await expect(column(page, "Edited").getByText(title)).toBeVisible();
  });

  test("dropping a card on Published nudges about the unchecked checklist", async ({
    page,
  }) => {
    const title = `${PREFIX} Drag to publish`;
    await seedTestIdea({ title, status: "edited" });
    await page.goto("/content/board");

    await dragCardToColumn(page, title, "Published");

    await expect(column(page, "Published").getByText(title)).toBeVisible();
    await expect(
      page.getByText(/Published with \d+ unchecked checklist items?/)
    ).toBeVisible();
  });

  test("cancelling a drag with Escape leaves the card in its own column", async ({
    page,
  }) => {
    const title = `${PREFIX} Never mind`;
    await seedTestIdea({ title, status: "scripted" });
    await page.goto("/content/board");

    await dragCardToColumn(page, title, "Recorded", { hold: true });
    await page.keyboard.press("Escape");
    await page.mouse.up();

    await expect(page.locator(DRAG_PREVIEW_SELECTOR)).toHaveCount(0);
    await expect(column(page, "Scripted").getByText(title)).toBeVisible();
    await expect(column(page, "Recorded").getByText(title)).toHaveCount(0);

    await page.reload();
    await expect(column(page, "Scripted").getByText(title)).toBeVisible();
  });

  test("the move menu still works after a drag, and the card list scrolls", async ({
    page,
  }) => {
    const title = `${PREFIX} Both paths`;
    await seedTestIdea({ title, status: "idea" });
    await page.goto("/content/board");

    await dragCardToColumn(page, title, "Scripted");
    await expect(column(page, "Scripted").getByText(title)).toBeVisible();

    // The fallback path is untouched by the drag wiring: same card, menu move.
    await moveCard(page, title, "Recorded");
    await expect(column(page, "Recorded").getByText(title)).toBeVisible();

    // The card list inside a column is still its own vertical scrollport.
    const cards = column(page, "Recorded").locator(
      '[data-slot="stage-column-cards"]'
    );
    await expect(cards).toHaveCSS("overflow-y", "auto");
  });
});

test.describe("content pipeline board mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);
  // Serial, like the desktop describe: every test here seeds and clears rows
  // under the same prefix, so running them in parallel would have one test's
  // cleanup sweep another's fixture out mid-flight.
  test.describe.configure({ mode: "serial" });

  const PREFIX = "[e2e-board-mobile]";

  test.afterEach(async () => {
    await clearTestIdeas(PREFIX);
  });

  test("columns scroll horizontally, and the move flow works one-handed", async ({
    page,
  }) => {
    const title = `${PREFIX} Mobile move`;
    await seedTestIdea({ title, status: "scripted" });
    await page.goto("/content/board");

    const board = page.locator('[data-slot="pipeline-board"]');
    await expect(board).toBeVisible();
    await expect
      .poll(() => board.evaluate((el) => el.scrollWidth))
      .toBeGreaterThan(await board.evaluate((el) => el.clientWidth));

    await moveCard(page, title, "Recorded");
    await expect(column(page, "Recorded").getByText(title)).toBeVisible();
  });

  test("a long press lifts a card, and dropping it on another column persists", async ({
    page,
  }) => {
    const title = `${PREFIX} Touch drag`;
    await seedTestIdea({ title, status: "scripted" });
    await page.goto("/content/board");

    await touchDragCardToColumn(page, title, "Recorded");

    await expect(column(page, "Recorded").getByText(title)).toBeVisible();
    await page.reload();
    await expect(column(page, "Recorded").getByText(title)).toBeVisible();
  });

  test("a horizontal swipe from a card scrolls the columns instead of lifting it", async ({
    page,
  }) => {
    const title = `${PREFIX} Swipe not lift`;
    await seedTestIdea({ title, status: "idea" });
    await page.goto("/content/board");

    const board = page.locator('[data-slot="pipeline-board"]');
    const card = page.locator(BOARD_CARD_SELECTOR, { hasText: title });
    await expect(card).toBeVisible();
    const { x: startX, y: startY } = await centerOf(card);

    // A swipe that moves before LONG_PRESS_MS reads as a scroll: no lift, and
    // the browser's own panning is left alone.
    await card.dispatchEvent("pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      clientX: startX,
      clientY: startY,
      bubbles: true,
    });
    for (const offset of [30, 80, 140, 200]) {
      await page.dispatchEvent("body", "pointermove", {
        pointerId: 1,
        pointerType: "touch",
        clientX: startX - offset,
        clientY: startY,
        bubbles: true,
      });
    }
    await expect(page.locator(DRAG_PREVIEW_SELECTOR)).toHaveCount(0);
    expect(await touchScrollingIsAllowed(page)).toBe(true);
    await page.dispatchEvent("body", "pointerup", {
      pointerId: 1,
      pointerType: "touch",
      clientX: startX - 200,
      clientY: startY,
      bubbles: true,
    });

    // Nothing moved, and the board is still free to scroll horizontally.
    await expect(column(page, "Idea").getByText(title)).toBeVisible();
    await board.evaluate((el) => el.scrollBy({ left: 200 }));
    await expect
      .poll(() => board.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
  });
});
