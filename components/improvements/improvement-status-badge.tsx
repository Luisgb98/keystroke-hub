import {
  IMPROVEMENT_STATUS_LABEL,
  type ImprovementStatus,
} from "@/lib/improvements/improvement-status";
import { Badge } from "@/components/ui/badge";

const VARIANT_BY_STATUS: Record<
  ImprovementStatus,
  "default" | "outline" | "secondary" | "destructive"
> = {
  proposed: "default",
  discussed: "secondary",
  accepted: "outline",
  rejected: "destructive",
  done: "secondary",
};

export function ImprovementStatusBadge({
  status,
}: {
  status: ImprovementStatus;
}) {
  return (
    <Badge variant={VARIANT_BY_STATUS[status]}>
      {IMPROVEMENT_STATUS_LABEL[status]}
    </Badge>
  );
}
