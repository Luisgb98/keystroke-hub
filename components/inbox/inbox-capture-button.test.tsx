import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OPEN_CAPTURE_EVENT } from "./inbox-capture-provider";

import { InboxCaptureButton } from "./inbox-capture-button";

describe("InboxCaptureButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks the shell to open capture via the global event", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    window.addEventListener(OPEN_CAPTURE_EVENT, onOpen);

    render(<InboxCaptureButton />);
    await user.click(screen.getByRole("button", { name: "Capture a thought" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_CAPTURE_EVENT, onOpen);
  });

  it("owns no dialog of its own — the shell provider does", () => {
    render(<InboxCaptureButton />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
