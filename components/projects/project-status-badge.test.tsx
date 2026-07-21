import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
} from "@/lib/projects/project-status";

import { ProjectStatusBadge } from "./project-status-badge";

describe("ProjectStatusBadge", () => {
  it("renders the label for every status", () => {
    for (const status of PROJECT_STATUSES) {
      const { unmount } = render(<ProjectStatusBadge status={status} />);
      expect(
        screen.getByText(PROJECT_STATUS_LABEL[status])
      ).toBeInTheDocument();
      unmount();
    }
  });
});
