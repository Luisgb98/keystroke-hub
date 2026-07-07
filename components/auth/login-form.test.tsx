import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LoginState } from "@/lib/auth/actions";

const login = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/actions", () => ({ login }));

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("renders a password field wired for password managers", () => {
    render(<LoginForm />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("carries the deep-linked path in a hidden `from` field", () => {
    const { container } = render(<LoginForm from="/journal" />);
    const hidden =
      container.querySelector<HTMLInputElement>('input[name="from"]');
    expect(hidden?.value).toBe("/journal");
  });

  it("omits the `from` field when there is no deep link", () => {
    const { container } = render(<LoginForm />);
    expect(container.querySelector('input[name="from"]')).toBeNull();
  });

  it("submits the password to the login action and surfaces its error", async () => {
    login.mockImplementation(
      async (_state: LoginState | undefined, formData: FormData) => {
        expect(formData.get("password")).toBe("nope");
        return { error: "That password isn't right." };
      }
    );

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Password"), "nope");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "That password isn't right."
      );
    });
    expect(login).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });
});
