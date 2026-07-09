import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const createStream = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/stream-actions", () => ({ createStream }));

import { StreamCreate } from "./stream-create";

describe("StreamCreate", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a floating 'New stream' button, closed by default", () => {
    render(<StreamCreate />);
    expect(
      screen.getByRole("button", { name: "New stream" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the capture dialog with the topic auto-focused", async () => {
    const user = userEvent.setup();
    render(<StreamCreate />);
    await user.click(screen.getByRole("button", { name: "New stream" }));

    const dialog = screen.getByRole("dialog", { name: "New stream" });
    expect(dialog).toBeVisible();
    expect(screen.getByLabelText("Topic")).toHaveFocus();
  });

  it("hides the date/time fields until 'Plan a date' is switched on", async () => {
    const user = userEvent.setup();
    render(<StreamCreate />);
    await user.click(screen.getByRole("button", { name: "New stream" }));

    expect(screen.queryByLabelText("Date")).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Plan a date" }));
    expect(screen.getByLabelText("Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Start time")).toBeInTheDocument();
  });

  it("hides the start time field when All day is on", async () => {
    const user = userEvent.setup();
    render(<StreamCreate />);
    await user.click(screen.getByRole("button", { name: "New stream" }));
    await user.click(screen.getByRole("switch", { name: "Plan a date" }));
    await user.click(screen.getByRole("switch", { name: "All day" }));

    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
  });

  it("submits a title-only, unplanned capture", async () => {
    createStream.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<StreamCreate />);
    await user.click(screen.getByRole("button", { name: "New stream" }));

    await user.type(screen.getByLabelText("Topic"), "Boss rush stream");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createStream).toHaveBeenCalledTimes(1));
    const [, formData] = createStream.mock.calls[0] as [unknown, FormData];
    expect(formData.get("title")).toBe("Boss rush stream");
    expect(formData.get("planned")).toBe("false");
  });

  it("submits planned date/time fields when planning a date", async () => {
    createStream.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<StreamCreate />);
    await user.click(screen.getByRole("button", { name: "New stream" }));
    await user.type(screen.getByLabelText("Topic"), "Boss rush stream");
    await user.click(screen.getByRole("switch", { name: "Plan a date" }));
    await user.type(screen.getByLabelText("Date"), "2026-08-01");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createStream).toHaveBeenCalledTimes(1));
    const [, formData] = createStream.mock.calls[0] as [unknown, FormData];
    expect(formData.get("planned")).toBe("true");
    expect(formData.get("date")).toBe("2026-08-01");
  });

  it("closes and resets after a successful capture", async () => {
    createStream.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<StreamCreate />);
    await user.click(screen.getByRole("button", { name: "New stream" }));
    await user.type(screen.getByLabelText("Topic"), "Boss rush stream");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("shows a field error on invalid input without closing", async () => {
    createStream.mockResolvedValue({
      error: "Check the highlighted fields.",
      fieldErrors: { title: ["Title is required"] },
    });
    const user = userEvent.setup();
    render(<StreamCreate />);
    await user.click(screen.getByRole("button", { name: "New stream" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeVisible();
  });
});
