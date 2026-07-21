import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  IMPROVEMENT_STATUS_LABEL,
  IMPROVEMENT_STATUSES,
} from "@/lib/improvements/improvement-status";

import { ImprovementStatusBadge } from "./improvement-status-badge";

describe("ImprovementStatusBadge", () => {
  it("renders the label for every status", () => {
    for (const status of IMPROVEMENT_STATUSES) {
      const { unmount } = render(<ImprovementStatusBadge status={status} />);
      expect(
        screen.getByText(IMPROVEMENT_STATUS_LABEL[status])
      ).toBeInTheDocument();
      unmount();
    }
  });
});
