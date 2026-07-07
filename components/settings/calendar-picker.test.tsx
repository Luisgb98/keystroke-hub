import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const finishConnect = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sync/actions", () => ({ finishConnect }));

const routerReplace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
}));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import { CalendarPicker } from "./calendar-picker";

const calendars = [
  { id: "primary-cal", summary: "owner@example.com", primary: true },
  { id: "secondary-cal", summary: "Side projects" },
];

describe("CalendarPicker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a message when the account has no calendars", () => {
    render(
      <CalendarPicker
        track="work"
        googleAccountEmail="owner@example.com"
        calendars={[]}
      />
    );
    expect(screen.getByText("No calendars found")).toBeInTheDocument();
  });

  it("defaults the selection to the primary calendar", async () => {
    finishConnect.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <CalendarPicker
        track="work"
        googleAccountEmail="owner@example.com"
        calendars={calendars}
      />
    );

    // Submitting without touching the picker confirms the pre-selected
    // (primary) calendar, not the placeholder / an empty value.
    await user.click(screen.getByRole("button", { name: "Use this calendar" }));
    await waitFor(() =>
      expect(finishConnect).toHaveBeenCalledWith("primary-cal")
    );
  });

  it("confirms the connection, toasts, and navigates away on success", async () => {
    finishConnect.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <CalendarPicker
        track="content"
        googleAccountEmail="owner@example.com"
        calendars={calendars}
      />
    );

    await user.click(screen.getByRole("button", { name: "Use this calendar" }));

    await waitFor(() =>
      expect(finishConnect).toHaveBeenCalledWith("primary-cal")
    );
    expect(toastSuccess).toHaveBeenCalled();
    expect(routerReplace).toHaveBeenCalledWith("/settings/calendars");
  });

  it("toasts an error and stays put when finishConnect fails", async () => {
    finishConnect.mockResolvedValue({
      error: "Work already has a connected calendar.",
    });
    const user = userEvent.setup();
    render(
      <CalendarPicker
        track="work"
        googleAccountEmail="owner@example.com"
        calendars={calendars}
      />
    );

    await user.click(screen.getByRole("button", { name: "Use this calendar" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Work already has a connected calendar."
      )
    );
    expect(routerReplace).not.toHaveBeenCalled();
  });
});
