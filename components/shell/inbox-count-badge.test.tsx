import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InboxCountBadge, inboxCountLabel } from "./inbox-count-badge";

describe("InboxCountBadge", () => {
  it("renders the count", () => {
    render(<InboxCountBadge count={12} />);
    const badge = document.querySelector('[data-slot="inbox-count"]');
    expect(badge).toHaveTextContent("12");
  });

  it("renders nothing at zero, so inbox zero stays quiet", () => {
    render(<InboxCountBadge count={0} />);
    expect(document.querySelector('[data-slot="inbox-count"]')).toBeNull();
  });

  it("renders nothing for a negative count", () => {
    render(<InboxCountBadge count={-1} />);
    expect(document.querySelector('[data-slot="inbox-count"]')).toBeNull();
  });

  it("merges caller classes — each nav surface positions its own badge", () => {
    render(<InboxCountBadge count={3} className="ml-auto" />);
    const badge = document.querySelector('[data-slot="inbox-count"]');
    expect(badge).toHaveClass("ml-auto");
    expect(badge).toHaveClass("bg-primary");
  });

  it("hides itself from the a11y tree — `inboxCountLabel` does the announcing", () => {
    render(<InboxCountBadge count={3} />);
    expect(document.querySelector('[data-slot="inbox-count"]')).toHaveAttribute(
      "aria-hidden"
    );
  });
});

describe("inboxCountLabel", () => {
  it("spells the count out for screen readers", () => {
    expect(inboxCountLabel(3)).toBe("3 to triage");
  });

  it("is undefined at inbox zero, matching the silent badge", () => {
    expect(inboxCountLabel(0)).toBeUndefined();
  });
});
