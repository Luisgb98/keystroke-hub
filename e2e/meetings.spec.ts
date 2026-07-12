import { expect, test } from "@playwright/test";

import { clearEventsWithPrefix, insertTestEvent } from "./support/events-db";
import { clearTestImprovements } from "./support/improvements-db";
import { clearTestMeetingNotes } from "./support/meeting-notes-db";
import { clearTestProjects } from "./support/projects-db";

// The meeting notes pages query the database on every render, so — like the
// improvements/projects suites — this only runs where DATABASE_URL is
// available (local dev or a Vercel preview), not in CI (see docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping meeting notes DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const CARD_SELECTOR = '[data-slot="meeting-note-card"]';
const PREFIX = "[e2e-meeting]";
const PROJECT_PREFIX = "[e2e-meeting-project]";
const IMPROVEMENT_PREFIX = "[e2e-meeting-improvement]";
const EVENT_PREFIX = "[e2e-meeting-event]";

/** Creates a meeting note through the real inline capture card. */
async function createMeetingNote(
  page: import("@playwright/test").Page,
  title: string,
  notes: string
) {
  await page.goto("/projects/meetings");
  await page.getByLabel("New meeting note").fill(title);
  await page.getByLabel("Notes", { exact: true }).fill(notes);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByLabel("New meeting note")).toHaveValue("", {
    timeout: 10000,
  });
}

/** Creates a project through the real inline capture card — same helper as projects.spec.ts. */
async function createProject(
  page: import("@playwright/test").Page,
  name: string
) {
  await page.goto("/projects");
  await page.getByLabel("New project").fill(name);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByLabel("New project")).toHaveValue("", {
    timeout: 10000,
  });
}

/** Creates an improvement through the real inline capture card — same helper as improvements.spec.ts. */
async function createImprovement(
  page: import("@playwright/test").Page,
  title: string
) {
  await page.goto("/projects/improvements");
  await page.getByLabel("New improvement").fill(title);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByLabel("New improvement")).toHaveValue("", {
    timeout: 10000,
  });
}

test.describe("meeting notes", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.afterEach(async () => {
    await clearTestMeetingNotes(PREFIX);
    await clearTestMeetingNotes(PROJECT_PREFIX);
    await clearTestMeetingNotes(IMPROVEMENT_PREFIX);
    await clearTestMeetingNotes(EVENT_PREFIX);
    await clearTestProjects(PROJECT_PREFIX);
    await clearTestImprovements(IMPROVEMENT_PREFIX);
    await clearEventsWithPrefix(EVENT_PREFIX);
  });

  test("quick-adding a meeting note shows it on the list", async ({ page }) => {
    const title = `${PREFIX} Weekly sync`;
    await createMeetingNote(page, title, "Discussed the roadmap.");
    await expect(page.locator(CARD_SELECTOR, { hasText: title })).toBeVisible();
  });

  test("editing a meeting note's details persists across reload", async ({
    page,
  }) => {
    const title = `${PREFIX} Planning session`;
    await createMeetingNote(page, title, "Initial notes.");
    await page.locator(CARD_SELECTOR, { hasText: title }).click();

    const renamed = `${title} (renamed)`;
    await page.getByLabel("Title").fill(renamed);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled({
      timeout: 10000,
    });

    await page.reload();
    await expect(page.getByLabel("Title")).toHaveValue(renamed);
  });

  test("linking a project at capture shows the chip and the note on the project's page", async ({
    page,
  }) => {
    const projectName = `${PROJECT_PREFIX} Keystroke Hub`;
    const title = `${PROJECT_PREFIX} Roadmap review`;
    await createProject(page, projectName);

    await page.goto("/projects/meetings");
    await page.getByLabel("New meeting note").fill(title);
    await page
      .getByLabel("Notes", { exact: true })
      .fill("Reviewed the roadmap.");
    await page.getByLabel("Related project (optional)").click();
    await page.getByRole("option", { name: projectName }).click();
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByLabel("New meeting note")).toHaveValue("", {
      timeout: 10000,
    });

    const card = page.locator(CARD_SELECTOR, { hasText: title });
    await expect(card.getByText(projectName)).toBeVisible();

    await page.goto("/projects");
    await page
      .locator('[data-slot="project-card"]', { hasText: projectName })
      .click();
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });

  test("searching finds a note by title and by notes body, with an empty state for no matches", async ({
    page,
  }) => {
    const title = `${PREFIX} Retro session`;
    const notesBody = `${PREFIX} unique-notes-marker discussed the incident`;
    await createMeetingNote(page, title, notesBody);

    await page.goto("/projects/meetings");
    await page.getByLabel("Search meeting notes").fill(title);
    await expect(page.locator(CARD_SELECTOR, { hasText: title })).toBeVisible({
      timeout: 10000,
    });

    await page.getByLabel("Search meeting notes").fill("unique-notes-marker");
    await expect(page.locator(CARD_SELECTOR, { hasText: title })).toBeVisible({
      timeout: 10000,
    });

    await page
      .getByLabel("Search meeting notes")
      .fill(`${PREFIX} no-such-meeting-exists`);
    await expect(
      page.getByText("No meeting notes match your search.")
    ).toBeVisible({ timeout: 10000 });
  });

  test("linking an improvement shows it on the meeting note, and it can be unlinked", async ({
    page,
  }) => {
    const meetingTitle = `${IMPROVEMENT_PREFIX} Retro`;
    const improvementTitle = `${IMPROVEMENT_PREFIX} Automate the changelog`;
    await createImprovement(page, improvementTitle);
    await createMeetingNote(page, meetingTitle, "Discussed improvements.");

    await page.locator(CARD_SELECTOR, { hasText: meetingTitle }).click();

    await page.getByRole("button", { name: "Link an improvement" }).click();
    const dialog = page.getByRole("dialog", { name: "Link an improvement" });
    await dialog.getByLabel("Search improvements").fill(improvementTitle);
    await dialog.getByText(improvementTitle).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    const section = page.locator('[data-slot="meeting-note-improvements"]');
    await expect(section.getByText(improvementTitle)).toBeVisible();

    await page
      .getByRole("button", { name: `Unlink "${improvementTitle}"` })
      .click();
    await expect(section.getByText(improvementTitle)).not.toBeVisible({
      timeout: 10000,
    });
  });

  test("attaching a work-track calendar event shows it on the meeting note, and it can be detached", async ({
    page,
  }) => {
    const eventTitle = `${EVENT_PREFIX} Team standup`;
    const meetingTitle = `${EVENT_PREFIX} Standup notes`;
    const startsAt = new Date();
    startsAt.setHours(9, 0, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setMinutes(30);
    await insertTestEvent({
      title: eventTitle,
      track: "work",
      startsAt,
      endsAt,
    });
    await createMeetingNote(page, meetingTitle, "Quick standup.");

    await page.locator(CARD_SELECTOR, { hasText: meetingTitle }).click();

    await page.getByRole("button", { name: "Attach an event" }).click();
    const dialog = page.getByRole("dialog", { name: "Attach an event" });
    await dialog.getByLabel("Search events").fill(eventTitle);
    await dialog.getByText(eventTitle).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    await expect(
      page.locator('[data-slot="meeting-note-event"]').getByText(eventTitle, {
        exact: false,
      })
    ).toBeVisible();

    await page.getByRole("button", { name: "Detach event" }).click();
    await expect(page.getByText("No event attached yet.")).toBeVisible({
      timeout: 10000,
    });
  });

  test("deleting a meeting note removes it from the list", async ({ page }) => {
    const title = `${PREFIX} Deletable meeting`;
    await createMeetingNote(page, title, "To be deleted.");
    await page.locator(CARD_SELECTOR, { hasText: title }).click();

    await page.getByRole("button", { name: "Delete" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete" })
      .click();

    await expect(page).toHaveURL(/\/projects\/meetings$/, { timeout: 10000 });
    await expect(
      page.locator(CARD_SELECTOR, { hasText: title })
    ).not.toBeVisible();
  });
});

// A separate prefix, so this describe (no file-level `serial` mode of its
// own) can run concurrently with the main describe above without racing its
// `afterEach` cleanup — same precedent as improvements.spec.ts.
const MOBILE_PREFIX = "[e2e-meeting-mobile]";

test.describe("meeting notes mobile viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test.skip(skip, skipReason);

  test.afterEach(async () => {
    await clearTestMeetingNotes(MOBILE_PREFIX);
  });

  test("the inline capture card is usable for one-handed capture", async ({
    page,
  }) => {
    const title = `${MOBILE_PREFIX} Mobile capture`;
    await page.goto("/projects/meetings");

    await page.getByLabel("New meeting note").fill(title);
    await page
      .getByLabel("Notes", { exact: true })
      .fill("Captured from mobile.");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.locator(CARD_SELECTOR, { hasText: title })).toBeVisible({
      timeout: 10000,
    });
  });
});
