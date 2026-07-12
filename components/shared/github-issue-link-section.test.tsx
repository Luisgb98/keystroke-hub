import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const attachGithubIssue = vi.hoisted(() => vi.fn());
const detachGithubIssue = vi.hoisted(() => vi.fn());
const refreshGithubIssueLink = vi.hoisted(() => vi.fn());
vi.mock("@/lib/github/actions", () => ({
  attachGithubIssue,
  detachGithubIssue,
  refreshGithubIssueLink,
}));

const toastFn = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(toastFn, { error: toastError }),
}));

import { TooltipProvider } from "@/components/ui/tooltip";
import type { GithubIssueLinkSummary } from "@/lib/data/github-links";
import { GithubIssueLinkSection } from "./github-issue-link-section";

const target = { type: "project" as const, id: "project-1" };

function link(
  overrides: Partial<GithubIssueLinkSummary> = {}
): GithubIssueLinkSummary {
  return {
    id: "link-1",
    owner: "Luisgb98",
    repo: "keystroke-hub",
    issueNumber: 27,
    title: "GitHub Issue linking on work items",
    state: "open",
    fetchedAt: new Date(),
    url: "https://github.com/Luisgb98/keystroke-hub/issues/27",
    ...overrides,
  };
}

function renderSection(
  props: Partial<Parameters<typeof GithubIssueLinkSection>[0]> = {}
) {
  return render(
    <TooltipProvider>
      <GithubIssueLinkSection target={target} links={[]} {...props} />
    </TooltipProvider>
  );
}

describe("GithubIssueLinkSection", () => {
  it("shows an empty state when nothing is linked", () => {
    renderSection();
    expect(
      screen.getByText("No GitHub issues linked yet.")
    ).toBeInTheDocument();
  });

  it("renders a chip for each linked issue", () => {
    renderSection({ links: [link()] });
    expect(screen.getByText("Luisgb98/keystroke-hub#27")).toBeInTheDocument();
  });

  it("attaches a pasted reference and clears the input on success", async () => {
    attachGithubIssue.mockResolvedValue({ linkId: "link-1" });
    const user = userEvent.setup();
    renderSection();

    await user.type(
      screen.getByLabelText("GitHub issue URL or owner/repo#123"),
      "owner/repo#1"
    );
    await user.click(screen.getByRole("button", { name: "Link issue" }));

    expect(attachGithubIssue).toHaveBeenCalledWith(target, "owner/repo#1");
    expect(
      screen.getByLabelText("GitHub issue URL or owner/repo#123")
    ).toHaveValue("");
  });

  it("shows an inline error and keeps the input when attaching fails", async () => {
    attachGithubIssue.mockResolvedValue({
      error: "Paste a GitHub issue URL or owner/repo#123.",
    });
    const user = userEvent.setup();
    renderSection();

    await user.type(
      screen.getByLabelText("GitHub issue URL or owner/repo#123"),
      "not a ref"
    );
    await user.click(screen.getByRole("button", { name: "Link issue" }));

    expect(
      await screen.findByText("Paste a GitHub issue URL or owner/repo#123.")
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("GitHub issue URL or owner/repo#123")
    ).toHaveValue("not a ref");
  });

  it("hides the attach input when disabled", () => {
    renderSection({ disabled: true });
    expect(
      screen.queryByLabelText("GitHub issue URL or owner/repo#123")
    ).not.toBeInTheDocument();
  });

  it("removes a link and offers undo", async () => {
    detachGithubIssue.mockResolvedValue({});
    const user = userEvent.setup();
    renderSection({ links: [link()] });

    await user.click(
      screen.getByRole("button", {
        name: "Remove link to Luisgb98/keystroke-hub#27",
      })
    );

    expect(detachGithubIssue).toHaveBeenCalledWith("link-1");
    expect(toastFn).toHaveBeenCalledWith(
      "Luisgb98/keystroke-hub#27 unlinked",
      expect.objectContaining({ action: expect.any(Object) })
    );
  });

  it("re-attaches the issue when undo is clicked", async () => {
    detachGithubIssue.mockResolvedValue({});
    attachGithubIssue.mockResolvedValue({ linkId: "link-1" });
    const user = userEvent.setup();
    renderSection({ links: [link()] });

    await user.click(
      screen.getByRole("button", {
        name: "Remove link to Luisgb98/keystroke-hub#27",
      })
    );

    const [, options] = toastFn.mock.calls[0];
    options.action.onClick();

    expect(attachGithubIssue).toHaveBeenCalledWith(
      target,
      "Luisgb98/keystroke-hub#27"
    );
  });

  it("does not render the attach input's remove affordance when disabled", () => {
    renderSection({ disabled: true, links: [link()] });
    expect(
      screen.queryByRole("button", {
        name: "Remove link to Luisgb98/keystroke-hub#27",
      })
    ).not.toBeInTheDocument();
  });
});
