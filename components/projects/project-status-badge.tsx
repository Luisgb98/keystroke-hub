import {
  PROJECT_STATUS_LABEL,
  type ProjectStatus,
} from "@/lib/projects/project-status";
import { Badge } from "@/components/ui/badge";

const VARIANT_BY_STATUS: Record<
  ProjectStatus,
  "default" | "outline" | "secondary"
> = {
  active: "default",
  paused: "outline",
  done: "secondary",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant={VARIANT_BY_STATUS[status]}>
      {PROJECT_STATUS_LABEL[status]}
    </Badge>
  );
}
