import { ThemeProvider } from "next-themes";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "./theme-toggle";

function renderToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
  });

  it("renders an accessible trigger", () => {
    renderToggle();
    expect(
      screen.getByRole("button", { name: "Toggle theme" })
    ).toBeInTheDocument();
  });

  it("switches to dark and persists the choice, applying the .dark class", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    await user.click(await screen.findByText("Dark"));

    await waitFor(() => {
      expect(window.localStorage.getItem("theme")).toBe("dark");
    });
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  it("switches to light, removing the .dark class", async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    await user.click(await screen.findByText("Light"));

    await waitFor(() => {
      expect(window.localStorage.getItem("theme")).toBe("light");
    });
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });
});
