import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import { ReadyToPublishView } from "./ready-to-publish-card";

const idea = {
  id: "idea-1",
  title: "Boss rush any% commentary",
  description: "Cold open.\n\nThen the run.",
  tags: ["speedrun", "boss rush"],
  stageEnteredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
};

describe("ReadyToPublishView", () => {
  it("shows an empty state, not nothing, when no idea is edited", () => {
    render(<ReadyToPublishView ideas={[]} />);
    expect(screen.getByText(/Nothing is edited and waiting/)).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("lists each edited idea with a link to its detail page", () => {
    render(<ReadyToPublishView ideas={[idea]} />);
    expect(
      screen.getByRole("link", { name: "Boss rush any% commentary" })
    ).toHaveAttribute("href", "/content/ideas/idea-1");
    expect(screen.getByText("Edited 2 days ago")).toBeInTheDocument();
  });

  it("hands each row the four copy blocks, disabled where empty", () => {
    render(
      <ReadyToPublishView
        ideas={[idea, { ...idea, id: "idea-2", description: null, tags: [] }]}
      />
    );
    const [full, bare] = screen.getAllByRole("listitem");

    for (const name of [
      "Copy Title",
      "Copy Title + tags",
      "Copy Description + tags",
      "Copy Tags",
    ]) {
      expect(within(full).getByRole("button", { name })).toBeEnabled();
    }
    expect(
      within(bare).getByRole("button", { name: "Copy Title" })
    ).toBeEnabled();
    expect(
      within(bare).getByRole("button", { name: "Copy Description + tags" })
    ).toBeDisabled();
    expect(
      within(bare).getByRole("button", { name: "Copy Tags" })
    ).toBeDisabled();
  });

  it("links out to the ideas list filtered to the edited stage", () => {
    render(<ReadyToPublishView ideas={[]} />);
    expect(screen.getByRole("link", { name: /Open in Ideas/ })).toHaveAttribute(
      "href",
      "/content/ideas?status=edited"
    );
  });
});
