import type { LucideIcon } from "lucide-react";

interface PlaceholderPanelProps {
  icon: LucideIcon;
}

export function PlaceholderPanel({ icon: Icon }: PlaceholderPanelProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
      <Icon aria-hidden className="size-8 text-muted-foreground" />
      <p className="text-small text-muted-foreground">
        This area is wired up and ready for its first feature.
      </p>
    </div>
  );
}
