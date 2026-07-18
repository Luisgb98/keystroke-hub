import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const openCapture = vi.hoisted(() => vi.fn());
vi.mock("./inbox-capture-provider", () => ({
  useInboxCapture: () => ({ openCapture }),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { CaptureDock } from "./capture-dock";

describe("CaptureDock", () => {
  afterEach(() => vi.clearAllMocks());

  it("opens the capture dialog when the capture button is pressed", async () => {
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
});
