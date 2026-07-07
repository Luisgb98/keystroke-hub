import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const disconnectCalendar = vi.hoisted(() => vi.fn());
const syncNow = vi.hoisted(() => vi.fn());
const startConnect = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sync/actions", () => ({
  disconnectCalendar,
  syncNow,
  startConnect,
}));

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import type { CalendarConnection } from "@/lib/db/schema";
import { CalendarConnectionCard } from "./calendar-connection-card";

function connection(
  overrides: Partial<CalendarConnection> = {}
): CalendarConnection {
  return {
    id: "conn-1",
    track: "work",
    googleAccountEmail: "owner@example.com",
    googleCalendarId: "cal-1",
    accessTokenEncrypted: "enc",
    refreshTokenEncrypted: "enc",
    tokenExpiresAt: new Date(),
    syncToken: null,
    channelId: null,
    channelResourceId: null,
    channelExpiresAt: null,
    channelToken: null,
    status: "active",
    lastSyncedAt: new Date(),
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("CalendarConnectionCard", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows a Connect form when no calendar is connected for the track", () => {
    render(<CalendarConnectionCard track="work" connection={null} />);
    expect(screen.getByText("No calendar connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Disconnect" })
    ).not.toBeInTheDocument();
  });

  it("shows connection status and account for a connected track", () => {
    render(<CalendarConnectionCard track="work" connection={connection()} />);
    expect(screen.getByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("surfaces the last sync error when the connection is in an error state", () => {
    render(
      <CalendarConnectionCard
        track="content"
        connection={connection({
          track: "content",
          status: "error",
          lastError: "Google token refresh failed: 400",
        })}
      />
    );
    expect(screen.getByText("Sync error")).toBeInTheDocument();
    expect(
      screen.getByText("Google token refresh failed: 400")
    ).toBeInTheDocument();
  });

  it("syncs on demand and toasts success", async () => {
    syncNow.mockResolvedValue({});
    const user = userEvent.setup();
    render(<CalendarConnectionCard track="work" connection={connection()} />);

    await user.click(screen.getByRole("button", { name: "Sync now" }));

    await waitFor(() => expect(syncNow).toHaveBeenCalledWith("work"));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("disconnects and toasts success", async () => {
    disconnectCalendar.mockResolvedValue({});
    const user = userEvent.setup();
    render(
      <CalendarConnectionCard
        track="content"
        connection={connection({ track: "content" })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() =>
      expect(disconnectCalendar).toHaveBeenCalledWith("content")
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("toasts an error when sync fails", async () => {
    syncNow.mockResolvedValue({ error: "Sync failed." });
    const user = userEvent.setup();
    render(<CalendarConnectionCard track="work" connection={connection()} />);

    await user.click(screen.getByRole("button", { name: "Sync now" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Sync failed.")
    );
  });
});
