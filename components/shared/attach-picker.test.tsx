import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError }),
}));

import { AttachPicker, type AttachPickerProps } from "./attach-picker";

interface Row {
  id: string;
  title: string;
}

const rows: Row[] = [
  { id: "a", title: "Alpha" },
  { id: "b", title: "Beta" },
];

function renderPicker(overrides: Partial<AttachPickerProps<Row>> = {}) {
  const search = vi.fn(async () => rows);
  const attach = vi.fn(async () => ({}) as { error?: string });
  const onOpenChange = vi.fn();
  const utils = render(
    <AttachPicker<Row>
      open
      onOpenChange={onOpenChange}
      title="Link a thing"
      description="Search things."
      searchPlaceholder="Search things…"
      searchAriaLabel="Search things"
      search={search}
      attach={attach}
      getKey={(r) => r.id}
      getTitle={(r) => r.title}
      successMessage={(r) => `"${r.title}" linked`}
      emptyWithQuery="No matching things."
      emptyWithoutQuery="No things left."
      {...overrides}
    />
  );
  return { search, attach, onOpenChange, ...utils };
}

describe("AttachPicker", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when closed", () => {
    renderPicker({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("loads and renders results when opened, with an empty initial query", async () => {
    const { search } = renderPicker();
    await waitFor(() => expect(search).toHaveBeenCalledWith(""));
    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("re-queries as the search text changes", async () => {
    const { search } = renderPicker();
    await screen.findByText("Alpha");
    await userEvent.type(screen.getByLabelText("Search things"), "be");
    await waitFor(() => expect(search).toHaveBeenLastCalledWith("be"));
  });

  it("does not refetch in a loop when the search prop is a fresh closure each render", async () => {
    // Inline closures (the shape every wrapper uses) must not retrigger the
    // effect on their own — only open/query/scope changes should (issue #67).
    const search = vi.fn(async () => rows);
    render(
      <AttachPicker<Row>
        open
        onOpenChange={vi.fn()}
        title="t"
        description="d"
        searchPlaceholder="p"
        searchAriaLabel="Search things"
        search={() => search()}
        attach={async () => ({})}
        getKey={(r) => r.id}
        getTitle={(r) => r.title}
        successMessage={() => "ok"}
        emptyWithQuery="none"
        emptyWithoutQuery="none"
      />
    );
    await screen.findByText("Alpha");
    // A settle window: a render loop would rack up many more calls than this.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("shows the with-query empty state when a search returns nothing", async () => {
    renderPicker({ search: vi.fn(async () => []) });
    expect(await screen.findByText("No things left.")).toBeInTheDocument();
  });

  it("attaches the selected row, toasts success, and closes", async () => {
    const { attach, onOpenChange } = renderPicker();
    await screen.findByText("Alpha");
    await userEvent.click(screen.getByText("Alpha"));
    await waitFor(() =>
      expect(attach).toHaveBeenCalledWith({ id: "a", title: "Alpha" })
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toastSuccess).toHaveBeenCalledWith('"Alpha" linked');
  });

  it("toasts an error and stays open when the attach fails", async () => {
    const { onOpenChange } = renderPicker({
      attach: vi.fn(async () => ({ error: "Nope." })),
    });
    await screen.findByText("Alpha");
    await userEvent.click(screen.getByText("Alpha"));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Nope."));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
