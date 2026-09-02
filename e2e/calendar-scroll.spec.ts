import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Issue #87: the app shell is viewport-locked, so the calendar page itself
 * never scrolls — the grid does, while the sidebar and the calendar header stay
 * exactly where they are. See docs/calendar.md#scroll-contract.
 *
 * None of this needs a database: the calendar page renders its shell and an
 * empty 24-hour grid (a fixed 96rem tall, `lib/calendar/constants.ts`) even
 * when `getEventsInRange` fails, so these checks run unconditionally in CI
 * (see docs/database.md).
 *
 * Every describe sizes the viewport with `page.setViewportSize` in a
 * `beforeEach` rather than `test.use({ viewport })` — an explicit resize is what
 * makes Chromium recompute `h-dvh`, which the whole shell's height hangs on.
 */

const VIEWS = ["day", "week", "month"] as const;

const DESKTOP = { width: 1280, height: 800 };
/** Short enough that the month grid and every page's content overflow it. */
const SHORT_DESKTOP = { width: 1280, height: 400 };
const PHONE = { width: 375, height: 812 };

/**
 * The visible view's one scrollport. Week view keeps both its phone list and
 * its desktop grid in the DOM and toggles them via breakpoints (see
 * docs/calendar.md), so exactly one of the two is ever visible.
 */
function scrollport(page: Page): Locator {
  return page.locator('[data-slot="calendar-scroll"]:visible');
}

async function documentScroll(page: Page) {
  return page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
}

/** The acceptance criterion itself: the page body never scrolls vertically. */
async function expectNoPageScroll(page: Page) {
  const { scrollHeight, clientHeight } = await documentScroll(page);
  // +1 absorbs sub-pixel rounding between `h-dvh` and the layout viewport.
  expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);
}

/**
 * The mechanism behind `expectNoPageScroll`: the shell is exactly the viewport
 * tall, so it can never grow with its content.
 *
 * Used instead of `expectNoPageScroll` below ~500px of viewport height, where
 * `documentElement.scrollHeight` isn't measurable under parallel load: once the
 * emulated viewport is shorter than the headless browser's real window,
 * Chromium keeps reporting the stale, larger root scroll area (476px in a 400px
 * viewport — the same wrong value for every test in the run, while 12 repeats in
 * isolation were exact, and with every overflowing box verifiably inside a
 * scroll container). The shell's own box stays correct, so assert on that.
 */
async function expectShellFillsViewport(page: Page) {
  const metrics = await page.evaluate(() => {
    const shell = document.querySelector("main")!.parentElement!;
    const box = shell.getBoundingClientRect();
    return {
      top: box.top,
      bottom: box.bottom,
      clientHeight: document.documentElement.clientHeight,
      // `overflow-hidden` means the shell has no scrollport of its own.
      shellOverflow: shell.scrollHeight - shell.clientHeight,
    };
  });

  expect(metrics.top).toBeLessThanOrEqual(0.5);
  expect(Math.abs(metrics.bottom - metrics.clientHeight)).toBeLessThanOrEqual(
    1
  );
  expect(metrics.shellOverflow).toBeLessThanOrEqual(1);
}

function scrollTopOf(locator: Locator) {
  return locator.evaluate((element) => element.scrollTop);
}

/** Polls rather than sampling once — web fonts settle layout after `load`. */
async function expectOverflows(target: Locator) {
  await expect
    .poll(() =>
      target.evaluate((element) => element.scrollHeight - element.clientHeight)
    )
    .toBeGreaterThan(0);
}

/** Wheels over the grid and resolves once it has actually scrolled. */
async function wheelOverGrid(page: Page, delta = 600) {
  const grid = scrollport(page);
  await grid.hover();
  await page.mouse.wheel(0, delta);
  await expect
    .poll(() => scrollTopOf(grid), { timeout: 5000 })
    .toBeGreaterThan(0);
}

test.describe("calendar scroll contract — desktop", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  for (const view of VIEWS) {
    test(`${view} view: the page has no vertical scroll of its own`, async ({
      page,
    }) => {
      await page.goto(`/calendar?view=${view}`);
      await expect(scrollport(page)).toHaveCount(1);

      await expectNoPageScroll(page);
    });

    test(`${view} view: the sidebar and header stay pinned while the grid scrolls`, async ({
      page,
    }) => {
      await page.goto(`/calendar?view=${view}`);

      const sidebar = page.locator("aside");
      const tabs = page.getByRole("tab", { name: "Week" });
      const newEvent = page.getByRole("button", { name: "New event" });
      await expect(sidebar).toBeVisible();

      const sidebarBefore = await sidebar.boundingBox();
      const tabsBefore = await tabs.boundingBox();
      const newEventBefore = await newEvent.boundingBox();

      // The month grid only overflows on a short window (covered below), so
      // wheel over the grid unconditionally here — nothing may move either way.
      await scrollport(page).hover();
      await page.mouse.wheel(0, 600);

      expect(await sidebar.boundingBox()).toEqual(sidebarBefore);
      expect(await tabs.boundingBox()).toEqual(tabsBefore);
      expect(await newEvent.boundingBox()).toEqual(newEventBefore);
      // Never taller than the viewport: the whole point of capping the shell.
      expect(sidebarBefore!.height).toBeLessThanOrEqual(DESKTOP.height);
    });

    test(`${view} view: the empty grid still fills the viewport`, async ({
      page,
    }) => {
      await page.goto(`/calendar?view=${view}`);

      const box = await scrollport(page).boundingBox();
      expect(box).not.toBeNull();
      // Reaches within the page's own bottom padding (`sm:py-8`) of the
      // viewport floor rather than collapsing to its content height.
      expect(box!.y + box!.height).toBeGreaterThan(DESKTOP.height - 80);
    });
  }

  for (const view of ["day", "week"] as const) {
    test(`${view} view: the 24-hour grid scrolls inside itself`, async ({
      page,
    }) => {
      await page.goto(`/calendar?view=${view}`);

      await expectOverflows(scrollport(page));
      await wheelOverGrid(page);

      // …and the document still didn't move.
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });
  }

  test("month view scrolls inside its own grid on a short window", async ({
    page,
  }) => {
    // 6 rows of `min-h-20` cells (30rem) plus the weekday header can't fit
    // here, so the grid — not the page — has to absorb the overflow.
    await page.setViewportSize({ width: 1280, height: 560 });
    await page.goto("/calendar?view=month");

    await expectOverflows(scrollport(page));

    const sidebarBefore = await page.locator("aside").boundingBox();
    await wheelOverGrid(page);

    await expectNoPageScroll(page);
    expect(await page.locator("aside").boundingBox()).toEqual(sidebarBefore);
  });

  test("reaching the far end of the 24-hour grid never moves the page", async ({
    page,
  }) => {
    await page.goto("/calendar?view=day");

    const grid = scrollport(page);
    // The 11 PM slot sits 96rem down — the same distance a dense day's late
    // events would be. Reaching it must not move the document.
    await grid
      .getByRole("button", { name: /Add event at 23:00/ })
      .scrollIntoViewIfNeeded();

    expect(await scrollTopOf(grid)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expectNoPageScroll(page);
  });
});

// Locking the shell moved every page's scrolling from the body into `<main>`.
// These guard the pages that relied on body scroll before.
test.describe("shell scroll non-regression", () => {
  test.describe("inside the app shell", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(SHORT_DESKTOP);
    });

    test("long pages scroll inside <main>, and the body stays put", async ({
      page,
    }) => {
      // The journal's plan/done/retro stack is structurally tall, so this
      // doesn't depend on how many rows the dev database happens to hold.
      await page.goto("/journal");

      await expectShellFillsViewport(page);

      const main = page.locator("main");
      await expectOverflows(main);

      // The bottom of the page is still reachable — it just lives in <main>.
      await main.evaluate((element) =>
        element.scrollTo(0, element.scrollHeight)
      );
      await expect
        .poll(() =>
          main.evaluate((element) =>
            Math.ceil(
              element.scrollHeight - element.clientHeight - element.scrollTop
            )
          )
        )
        .toBeLessThanOrEqual(2);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });

    test("the sidebar is height-capped on every page, not just the calendar", async ({
      page,
    }) => {
      for (const path of ["/", "/journal", "/content/ideas", "/inbox"]) {
        await page.goto(path);
        await expectShellFillsViewport(page);

        const box = await page.locator("aside").boundingBox();
        expect(box, `expected a sidebar on ${path}`).not.toBeNull();
        expect(
          box!.height,
          `sidebar overflowed the viewport on ${path}`
        ).toBeLessThanOrEqual(SHORT_DESKTOP.height);
      }
    });

    test("a window shorter than the nav scrolls the sidebar, not the shell", async ({
      page,
    }) => {
      await page.goto("/");

      const sidebar = page.locator("aside");
      await expectOverflows(sidebar);

      // The theme/settings footer is the first thing a hard cap would clip.
      const settings = sidebar.getByLabel("Settings");
      await settings.scrollIntoViewIfNeeded();
      await expect(settings).toBeInViewport();

      await expectShellFillsViewport(page);
    });
  });

  test.describe("outside the app shell", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 500 });
    });

    // `/styleguide` and `/login` render outside `app/(app)/layout.tsx` and
    // still own the body scrollport — the styleguide's section nav is
    // `sticky top-0` against it.
    test("the styleguide still scrolls the body and keeps its sticky nav", async ({
      page,
    }) => {
      await page.goto("/styleguide");

      const { scrollHeight, clientHeight } = await documentScroll(page);
      expect(scrollHeight).toBeGreaterThan(clientHeight);

      const nav = page.getByRole("navigation", { name: "Styleguide sections" });
      await expect(nav).toBeVisible();

      await page.getByRole("link", { name: "Components" }).click();
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(0);
      await expect(nav).toBeInViewport();
    });
  });
});

test.describe("calendar scroll contract — phone", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
  });

  test("the week agenda list scrolls while the bottom nav stays tappable", async ({
    page,
  }) => {
    // Seven day sections just about fit a tall phone even when empty, so shrink
    // to a small-phone height (the height a visible browser UI leaves behind)
    // where the list has to scroll no matter how few events exist.
    await page.setViewportSize({ width: PHONE.width, height: 600 });
    await page.goto("/calendar?view=week");

    await expectNoPageScroll(page);

    const list = scrollport(page);
    await expect(list).toHaveCount(1);
    await expect(list).toHaveClass(/md:hidden/);

    const nav = page.getByRole("navigation", { name: "Primary" });
    const navBefore = await nav.boundingBox();
    await expect(nav).toBeInViewport();

    // Sunday's section is off-screen until the list itself scrolls.
    await list
      .getByRole("heading", { level: 2 })
      .last()
      .scrollIntoViewIfNeeded();
    expect(await scrollTopOf(list)).toBeGreaterThan(0);

    expect(await nav.boundingBox()).toEqual(navBefore);
    await expect(nav).toBeInViewport();

    // The bar is still reachable after the list scrolled — proven by driving
    // it: More opens, and the Inbox row behind it navigates (#114 moved the
    // Inbox tab into that sheet).
    await nav.getByRole("button", { name: /More/ }).click();
    await page
      .getByRole("navigation", { name: "More" })
      .getByRole("link", { name: /Inbox/ })
      .click();
    await expect(page).toHaveURL(/\/inbox$/);
  });

  test("the day view time grid scrolls without moving the page", async ({
    page,
  }) => {
    await page.goto("/calendar?view=day");

    const grid = scrollport(page);
    await grid
      .getByRole("button", { name: /Add event at 23:00/ })
      .scrollIntoViewIfNeeded();

    expect(await scrollTopOf(grid)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expectNoPageScroll(page);
  });

  test("no horizontal overflow in any view", async ({ page }) => {
    for (const view of VIEWS) {
      await page.goto(`/calendar?view=${view}`);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        scrollWidth,
        `${view} view overflowed horizontally`
      ).toBeLessThanOrEqual(clientWidth);
    }
  });
});
