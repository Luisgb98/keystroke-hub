import { expect, test } from "@playwright/test";

import { clearTestGithubIssueLinks } from "./support/github-links-db";
import { resetFakeGithub, setFakeGithubIssue } from "./support/fake-github";
import { clearTestProjects } from "./support/projects-db";

// GitHub metadata is fetched server-side, so this only runs where
// DATABASE_URL is available (local dev or a Vercel preview), not in CI —
// same rationale as the projects/improvements/meetings suites (see
// docs/database.md).
const skip = !process.env.DATABASE_URL;
const skipReason =
  "DATABASE_URL is not set — skipping GitHub link DB-backed checks. Set it " +
  "locally (see .env.example) or on a Vercel preview to exercise this.";

const PREFIX = "[e2e-github]";
// Owner must satisfy GitHub's username character rules (alphanumeric or
// single hyphens) — the bracketed prefixes other specs use for cleanup
// aren't valid here, so `clearTestGithubIssueLinks` filters by this plain
// owner instead.
const OWNER = "e2e-github-owner";
const REPO = "keystroke-hub";

const ISSUE_INPUT_LABEL = "GitHub issue URL or owner/repo#123";

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

async function openProject(
  page: import("@playwright/test").Page,
  name: string
) {
  await page.goto("/projects");
  await page.locator('[data-slot="project-card"]', { hasText: name }).click();
}

async function attach(page: import("@playwright/test").Page, ref: string) {
  await page.getByLabel(ISSUE_INPUT_LABEL).fill(ref);
  await page.getByRole("button", { name: "Link issue" }).click();
}

test.describe("GitHub issue linking", () => {
  test.skip(skip, skipReason);
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await resetFakeGithub();
  });

  test.afterEach(async () => {
    await clearTestProjects(PREFIX);
    await clearTestGithubIssueLinks(OWNER);
    await resetFakeGithub();
  });

  test("attaching by shorthand shows a chip whose title/state resolve from GitHub", async ({
    page,
  }) => {
    const projectName = `${PREFIX} Keystroke Hub`;
    await createProject(page, projectName);
    await setFakeGithubIssue({
      owner: OWNER,
      repo: REPO,
      issueNumber: 1,
      title: "Add dark mode",
      state: "open",
    });

    await openProject(page, projectName);
    await attach(page, `${OWNER}/${REPO}#1`);

    const chip = page.locator('[data-slot="github-issue-chip"]', {
      hasText: `${OWNER}/${REPO}#1`,
    });
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(chip.getByText("Add dark mode")).toBeVisible();
    await expect(chip.getByRole("link")).toHaveAttribute(
      "href",
      `https://github.com/${OWNER}/${REPO}/issues/1`
    );
  });

  test("attaching multiple issues shows each as its own chip", async ({
    page,
  }) => {
    const projectName = `${PREFIX} Multi-link project`;
    await createProject(page, projectName);
    await setFakeGithubIssue({
      owner: OWNER,
      repo: REPO,
      issueNumber: 2,
      title: "First",
      state: "open",
    });
    await setFakeGithubIssue({
      owner: OWNER,
      repo: REPO,
      issueNumber: 3,
      title: "Second",
      state: "closed",
    });

    await openProject(page, projectName);
    await attach(page, `${OWNER}/${REPO}#2`);
    await expect(
      page.locator('[data-slot="github-issue-chip"]', { hasText: "#2" })
    ).toBeVisible({ timeout: 10000 });

    await attach(page, `${OWNER}/${REPO}#3`);
    await expect(
      page.locator('[data-slot="github-issue-chip"]', { hasText: "#3" })
    ).toBeVisible({ timeout: 10000 });

    await expect(page.locator('[data-slot="github-issue-chip"]')).toHaveCount(
      2
    );
  });

  test("shows an inline error for an invalid reference, and doesn't attach it", async ({
    page,
  }) => {
    const projectName = `${PREFIX} Invalid ref project`;
    await createProject(page, projectName);

    await openProject(page, projectName);
    await attach(page, "not a github reference");

    await expect(
      page.getByText("Paste a GitHub issue URL or owner/repo#123.")
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-slot="github-issue-chip"]')).toHaveCount(
      0
    );
  });

  test("an issue GitHub can't resolve still attaches, rendered as state unknown", async ({
    page,
  }) => {
    const projectName = `${PREFIX} Unresolvable issue project`;
    await createProject(page, projectName);
    // Issue #4 is never registered with the fake server — GitHub 404s it.

    await openProject(page, projectName);
    await attach(page, `${OWNER}/${REPO}#4`);

    const chip = page.locator('[data-slot="github-issue-chip"]', {
      hasText: `${OWNER}/${REPO}#4`,
    });
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(chip.getByText("State unknown")).toBeAttached();
  });

  test("detaching a link removes it, and undo restores it", async ({
    page,
  }) => {
    const projectName = `${PREFIX} Detach project`;
    await createProject(page, projectName);
    await setFakeGithubIssue({
      owner: OWNER,
      repo: REPO,
      issueNumber: 5,
      title: "Detach me",
      state: "open",
    });

    await openProject(page, projectName);
    await attach(page, `${OWNER}/${REPO}#5`);
    const chip = page.locator('[data-slot="github-issue-chip"]', {
      hasText: `${OWNER}/${REPO}#5`,
    });
    await expect(chip).toBeVisible({ timeout: 10000 });

    await page
      .getByRole("button", { name: `Remove link to ${OWNER}/${REPO}#5` })
      .click();
    await expect(chip).not.toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(
      page.locator('[data-slot="github-issue-chip"]', {
        hasText: `${OWNER}/${REPO}#5`,
      })
    ).toBeVisible({ timeout: 10000 });
  });

  test("a linked issue survives a reload", async ({ page }) => {
    const projectName = `${PREFIX} Reload project`;
    await createProject(page, projectName);
    await setFakeGithubIssue({
      owner: OWNER,
      repo: REPO,
      issueNumber: 6,
      title: "Persisted",
      state: "open",
    });

    await openProject(page, projectName);
    await attach(page, `${OWNER}/${REPO}#6`);
    await expect(
      page.locator('[data-slot="github-issue-chip"]', {
        hasText: `${OWNER}/${REPO}#6`,
      })
    ).toBeVisible({ timeout: 10000 });

    await page.reload();
    await expect(
      page.locator('[data-slot="github-issue-chip"]', {
        hasText: `${OWNER}/${REPO}#6`,
      })
    ).toBeVisible();
  });
});
