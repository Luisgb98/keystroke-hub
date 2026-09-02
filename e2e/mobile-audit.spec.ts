import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The standing mobile contract (#114), enforced page by page at a phone
 * viewport: nothing scrolls sideways, every control is big enough to hit, and
 * a form dialog opens as a bottom sheet with its Save button already on
 * screen.
 *
 * Read-only by design — it navigates and measures, never writes — so it can run
 * under the `iphone` project alongside the desktop suite without racing it for
 * rows in the shared development database.
 */

/** Apple's minimum, minus a hair for sub-pixel layout rounding. */
const MIN_TOUCH_TARGET = 40;

/**
 * Controls that are deliberately below the bar, each for a reason that would
 * cost more than it buys to "fix". The e2e check is only worth having if it
 * fails on a real regression, so every exemption is named rather than the
 * threshold being lowered to whatever currently passes.
 */
const EXEMPT = [
  // Inline text links inside a sentence or a card's metadata row. WCAG 2.5.8
  // exempts these outright: padding an inline link to 44px breaks the line
  // box it lives in.
  /^a\[/,
  // The month grid gets seven columns out of 390px, so a cell is ~52px wide.
  // A 44px chip or add-button would leave no cell to put it in; the day
  // itself opens the full day view.
  /^button\[Add event on /,
  /^button\[(Work|Content|Stream): /,
  // The calendar/clock popover triggers sit *inside* a 44px field whose typed
  // input is the primary target — a taller button would spill out of it.
  /^button\[Open .*calendar\]/,
  // `size="xs"` — the inline-chip size, used inside rows of text where a 44px
  // control would out-shout the content it belongs to (see components/ui/button.tsx).
  /^button\[Open publish checklist /,
  // Secondary action inside a chip that is itself a 44px target.
  /^button\[Unlink from /,
  // The release chip's own trigger: fills its 44px chip minus the chip's padding.
  /^button\[Reschedule release/,
];

async function undersizedControls(page: Page): Promise<string[]> {
  const found = await page.evaluate((min) => {
    const out: string[] = [];
    for (const el of document.querySelectorAll(
      'button, a, [role="button"], [role="radio"], input, select, textarea'
    )) {
      const rect = el.getBoundingClientRect();
      // Zero-sized elements are hidden or purely structural (e.g. a form's
      // hidden mirror field), not something anyone can aim at.
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.height >= min) continue;
      const name = (el.getAttribute("aria-label") || el.textContent || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40);
      out.push(`${el.tagName.toLowerCase()}[${name}]`);
    }
    return [...new Set(out)];
  }, MIN_TOUCH_TARGET);

  return found.filter(
    (entry) => !EXEMPT.some((pattern) => pattern.test(entry))
  );
}

/**
 * Waits out the sheet's slide-in. Every geometry assertion below has to run
 * against the settled position — mid-animation the popup is still translated
 * down by part of its own height, which reads as "not docked".
 */
async function settled(dialog: Locator): Promise<void> {
  await dialog.evaluate((node) =>
    Promise.all(
      node
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined))
    )
  );
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
}

const PAGES: [string, string][] = [
  ["dashboard", "/"],
  ["calendar day", "/calendar?view=day"],
  ["calendar week", "/calendar?view=week"],
  ["calendar month", "/calendar?view=month"],
  ["content", "/content"],
  ["ideas list", "/content/ideas"],
  ["board", "/content/board"],
  ["streams", "/content/streams"],
  ["games", "/content/games"],
  ["journal day", "/journal"],
  ["journal week", "/journal/week"],
  ["projects", "/projects"],
  ["meetings", "/projects/meetings"],
  ["improvements", "/projects/improvements"],
  ["inbox", "/inbox"],
  ["settings", "/settings/calendars"],
];

test.describe("mobile page audit", () => {
  for (const [name, url] of PAGES) {
    test(`${name} has no sideways scroll and no undersized controls`, async ({
      page,
    }) => {
      await page.goto(url);
      await expect(
        page.getByRole("navigation", { name: "Primary" })
      ).toBeVisible();

      expect(await horizontalOverflow(page), `${name} scrolls sideways`).toBe(
        0
      );
      expect(
        await undersizedControls(page),
        `${name} has controls under ${MIN_TOUCH_TARGET}px tall`
      ).toEqual([]);
    });
  }
});

test.describe("form dialogs are bottom sheets", () => {
  // Opening a dialog writes nothing, so these stay safe to run beside the
  // desktop suite.
  const CASES: [string, string, string, string][] = [
    ["event editor", "/calendar?view=day", "New event", "Save"],
    ["idea editor", "/content/ideas", "New idea", "Save"],
    ["stream create", "/content/streams", "New stream", "Save"],
    ["inbox capture", "/inbox", "Capture a thought", "Capture"],
  ];

  for (const [name, url, trigger, submit] of CASES) {
    test(`${name} opens docked to the bottom with its action already visible`, async ({
      page,
    }) => {
      await page.goto(url);
      await page.getByRole("button", { name: trigger }).first().click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await settled(dialog);

      // Measured in the page rather than through `boundingBox()`: under
      // Playwright's mobile emulation the layout viewport a `fixed` element
      // positions against isn't the same box `viewportSize()` reports.
      const geometry = await dialog.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        };
      });

      // Docked: full width, sitting on the bottom edge — not a shrunken
      // desktop window floating in the middle of the screen (#114).
      expect(geometry.left).toBe(0);
      expect(geometry.right).toBe(geometry.width);
      expect(geometry.bottom).toBe(geometry.height);

      // The submit button is on screen the moment the sheet opens — before
      // #114 the whole panel scrolled, so on a long form it started below the
      // fold with the title scrolled away above it.
      const action = dialog.getByRole("button", { name: submit });
      await expect(action).toBeInViewport({ ratio: 1 });
    });
  }

  test("a long form scrolls its fields while the header and action stay put", async ({
    page,
  }) => {
    await page.goto("/content/ideas");
    await page.getByRole("button", { name: "New idea" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await settled(dialog);
    const title = dialog.getByText("New idea", { exact: true });
    const save = dialog.getByRole("button", { name: "Save" });
    await expect(title).toBeInViewport({ ratio: 1 });

    const body = dialog.locator('[data-slot="dialog-body"]');
    await body.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    expect(await body.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);

    await expect(title).toBeInViewport({ ratio: 1 });
    await expect(save).toBeInViewport({ ratio: 1 });
  });
});

test.describe("no iOS focus zoom", () => {
  test("every text field renders at 16px or larger", async ({ page }) => {
    // Safari zooms the whole page when a field with a computed font-size below
    // 16px takes focus, which is most of what makes typing in a web app on an
    // iPhone feel janky.
    await page.goto("/content/ideas");
    await page.getByRole("button", { name: "New idea" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const tooSmall = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll("input, textarea, select")) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 16) {
          out.push(
            `${el.tagName.toLowerCase()}[${el.getAttribute("aria-label") ?? el.getAttribute("name") ?? ""}] ${size}px`
          );
        }
      }
      return out;
    });

    expect(tooSmall).toEqual([]);
  });
});

test.describe("single-day content on a phone", () => {
  // Read-only, like everything else in this file: it opens the editor and
  // measures, never saves.
  test("a stream asks for one date, not two", async ({ page }) => {
    // The whole point of #115 on a phone — the second date picker was the
    // most expensive field on the smallest screen.
    await page.goto("/calendar?view=day");
    await page.getByRole("button", { name: "New event" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await settled(dialog);

    await dialog.getByRole("radio", { name: /stream/i }).click();

    // `getByLabel` matches substrings, so "End" would also catch "End time"
    // and "Choose ending time" — the end *date* is the one that must be gone.
    await expect(dialog.getByLabel("Date", { exact: true })).toBeVisible();
    await expect(dialog.getByLabel("End", { exact: true })).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Open ending day calendar" })
    ).toHaveCount(0);

    // Both time fields survive, and both are real touch targets.
    for (const label of ["Start time", "End time"]) {
      const box = (await dialog.getByLabel(label).boundingBox())!;
      expect(box.height, label).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
  });
});
