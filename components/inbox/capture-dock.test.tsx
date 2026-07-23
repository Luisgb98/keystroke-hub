import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openCapture = vi.hoisted(() => vi.fn());
vi.mock("./inbox-capture-provider", () => ({
  useInboxCapture: () => ({ openCapture }),
}));

const useDockAction = vi.hoisted(() => vi.fn());
vi.mock("@/components/shell/dock-action-provider", () => ({ useDockAction }));

import { CaptureDock } from "./capture-dock";

describe("CaptureDock", () => {
  beforeEach(() => useDockAction.mockReturnValue(null));
  afterEach(() => vi.clearAllMocks());

  it("shows the global capture button and opens capture when pressed", async () => {
    const user = userEvent.setup();
    render(<CaptureDock untriagedCount={0} />);

    await user.click(screen.getByRole("button", { name: "Capture a thought" }));
    expect(openCapture).toHaveBeenCalled();
  });

  it("links to the inbox and hides the count when empty", () => {
    render(<CaptureDock untriagedCount={0} />);
    expect(screen.getByRole("link", { name: /Inbox/ })).toHaveAttribute(
      "href",
      "/inbox"
    );
    expect(document.querySelector('[data-slot="inbox-count"]')).toBeNull();
  });

  it("shows the untriaged count when there are entries", () => {
    render(<CaptureDock untriagedCount={7} />);
    const count = document.querySelector('[data-slot="inbox-count"]');
    expect(count).not.toBeNull();
    expect(count).toHaveTextContent("7");
  });

  it("renders a registered page action instead of the capture button", async () => {
    const onSelect = vi.fn();
    useDockAction.mockReturnValue({
      label: "New idea",
      icon: Plus,
      onSelect,
    });
    const user = userEvent.setup();
    render(<CaptureDock untriagedCount={0} />);

    expect(
      screen.queryByRole("button", { name: "Capture a thought" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New idea" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    // The inbox link stays put above the single primary action.
    expect(screen.getByRole("link", { name: /Inbox/ })).toBeInTheDocument();
  });
});
