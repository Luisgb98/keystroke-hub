import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  DockActionProvider,
  useDockAction,
  useRegisterDockAction,
} from "./dock-action-provider";

/** Surfaces the active dock action as a button, or "capture" when none. */
function DockSurface() {
  const action = useDockAction();
  if (!action) return <span>capture</span>;
  const Icon = action.icon;
  return (
    <button type="button" onClick={action.onSelect}>
      <Icon aria-hidden />
      {action.label}
    </button>
  );
}

function Registrant({
  label,
  onSelect = () => {},
}: {
  label: string;
  onSelect?: () => void;
}) {
  useRegisterDockAction(label, Plus, onSelect);
  return null;
}

describe("DockActionProvider", () => {
  it("exposes no page action by default", () => {
    render(
      <DockActionProvider>
        <DockSurface />
      </DockActionProvider>
    );
    expect(screen.getByText("capture")).toBeInTheDocument();
  });

  it("surfaces a registered page action", () => {
    render(
      <DockActionProvider>
        <Registrant label="New idea" />
        <DockSurface />
      </DockActionProvider>
    );
    expect(
      screen.getByRole("button", { name: "New idea" })
    ).toBeInTheDocument();
    expect(screen.queryByText("capture")).not.toBeInTheDocument();
  });

  it("invokes the registered action's onSelect", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <DockActionProvider>
        <Registrant label="New idea" onSelect={onSelect} />
        <DockSurface />
      </DockActionProvider>
    );

    await user.click(screen.getByRole("button", { name: "New idea" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("clears the action when the registrant unmounts", async () => {
    function Harness() {
      const [mounted, setMounted] = useState(true);
      return (
        <DockActionProvider>
          {mounted ? <Registrant label="New idea" /> : null}
          <DockSurface />
          <button type="button" onClick={() => setMounted(false)}>
            unmount
          </button>
        </DockActionProvider>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);

    expect(
      screen.getByRole("button", { name: "New idea" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "unmount" }));
    expect(
      screen.queryByRole("button", { name: "New idea" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("capture")).toBeInTheDocument();
  });

  it("shows the most recent action when two are registered", () => {
    render(
      <DockActionProvider>
        <Registrant label="New idea" />
        <Registrant label="New stream" />
        <DockSurface />
      </DockActionProvider>
    );
    expect(
      screen.getByRole("button", { name: "New stream" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "New idea" })
    ).not.toBeInTheDocument();
  });
});
