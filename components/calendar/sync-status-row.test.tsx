import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SyncStatusRow } from "./sync-status-row";

describe("SyncStatusRow", () => {
  it("renders nothing when no track is connected", () => {
    const { container } = render(<SyncStatusRow connections={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a relative last-synced time for an active connection", () => {
    render(
      <SyncStatusRow
        connections={[
          { track: "work", status: "active", lastSyncedAt: new Date() },
        ]}
      />
    );
    expect(screen.getByText(/Work:/)).toBeInTheDocument();
    expect(screen.getByText(/synced/)).toBeInTheDocument();
  });

  it("shows 'not synced yet' before the first sync completes", () => {
    render(
      <SyncStatusRow
        connections={[
          { track: "content", status: "active", lastSyncedAt: null },
        ]}
      />
    );
    expect(screen.getByText(/not synced yet/)).toBeInTheDocument();
  });

  it("surfaces an error state distinctly", () => {
    render(
      <SyncStatusRow
        connections={[
          { track: "work", status: "error", lastSyncedAt: new Date() },
        ]}
      />
    );
    expect(screen.getByText(/sync error/)).toBeInTheDocument();
  });
});
