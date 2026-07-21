import { Briefcase, Clapperboard } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const items = [
  {
    track: "work" as const,
    icon: Briefcase,
    title: "Ship the auth flow",
    description: "Due today · Project: Keystroke Hub",
  },
  {
    track: "content" as const,
    icon: Clapperboard,
    title: 'Script: "Why I rebuilt my dashboard"',
    description: "Draft · Video schedule",
  },
];

export function DualTrackShowcase() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map(({ track, icon: Icon, title, description }) => (
        <Card
          key={track}
          className={
            track === "work"
              ? "border-track-work-border bg-track-work"
              : "border-track-content-border bg-track-content"
          }
        >
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon
                aria-hidden
                className={
                  track === "work"
                    ? "size-4 text-track-work-foreground"
                    : "size-4 text-track-content-foreground"
                }
              />
              <Badge
                variant="outline"
                className={
                  track === "work"
                    ? "border-track-work-border text-track-work-foreground"
                    : "border-track-content-border text-track-content-foreground"
                }
              >
                {track === "work" ? "Work" : "Content"}
              </Badge>
            </div>
            <CardTitle
              className={
                track === "work"
                  ? "text-track-work-foreground"
                  : "text-track-content-foreground"
              }
            >
              {title}
            </CardTitle>
            <CardDescription
              className={
                track === "work"
                  ? "text-track-work-foreground/80"
                  : "text-track-content-foreground/80"
              }
            >
              {description}
            </CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
