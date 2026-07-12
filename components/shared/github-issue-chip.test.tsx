import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const refreshGithubIssueLink = vi.hoisted(() => vi.fn());
vi.mock("@/lib/github/actions", () => ({ refreshGithubIssueLink }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: toastError }),
}));

import { TooltipProvider } from "@/components/ui/tooltip";
import type { GithubIssueLinkSummary } from "@/lib/data/github-links";
import { GithubIssueChip } from "./github-issue-chip";

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

function renderChip(props: Parameters<typeof GithubIssueChip>[0]) {
  return render(
    <TooltipProvider>
      <GithubIssueChip {...props} />
    </TooltipProvider>
  );
}

describe("GithubIssueChip", () => {
  it("renders owner/repo#number and links to GitHub in a new tab", () => {
    renderChip({ link: link() });
    const anchor = screen.getByRole("link");
    expect(anchor).toHaveAttribute(
      "href",
      "https://github.com/Luisgb98/keystroke-hub/issues/27"
    );
    expect(anchor).toHaveAttribute("target", "_blank");
    expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Luisgb98/keystroke-hub#27")).toBeInTheDocument();
  });

  it("labels the open state for assistive tech", () => {
    renderChip({ link: link({ state: "open" }) });
    expect(screen.getByText("Open")).toHaveClass("sr-only");
  });

  it("labels the closed state for assistive tech", () => {
    renderChip({ link: link({ state: "closed" }) });
    expect(screen.getByText("Closed")).toHaveClass("sr-only");
  });

  it("shows a 'state unknown' label when the metadata snapshot is null", () => {
    renderChip({ link: link({ state: null, title: null }) });
    expect(screen.getByText("State unknown")).toHaveClass("sr-only");
  });

  it("refreshes the link on demand", async () => {
    refreshGithubIssueLink.mockResolvedValue({});
    const user = userEvent.setup();
    renderChip({ link: link() });

    await user.click(
      screen.getByRole("button", {
        name: "Refresh state for Luisgb98/keystroke-hub#27",
      })
    );

    expect(refreshGithubIssueLink).toHaveBeenCalledWith("link-1");
  });

  it("toasts an error when the refresh fails", async () => {
    refreshGithubIssueLink.mockResolvedValue({
      error: "Couldn't reach GitHub.",
    });
    const user = userEvent.setup();
    renderChip({ link: link() });

    await user.click(
      screen.getByRole("button", {
        name: "Refresh state for Luisgb98/keystroke-hub#27",
      })
    );

    expect(toastError).toHaveBeenCalledWith("Couldn't reach GitHub.");
  });

  it("hides the remove affordance when onRemove is omitted", () => {
    renderChip({ link: link() });
    expect(
      screen.queryByRole("button", {
        name: "Remove link to Luisgb98/keystroke-hub#27",
      })
    ).not.toBeInTheDocument();
  });

  it("calls onRemove when the remove button is clicked", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    renderChip({ link: link(), onRemove });

    await user.click(
      screen.getByRole("button", {
        name: "Remove link to Luisgb98/keystroke-hub#27",
      })
    );

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
