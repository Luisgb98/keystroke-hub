import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TRACK_ICON, TRACK_LABEL } from "@/components/calendar/track-styles";
import { TRACK_KINDS, type TrackKind } from "@/lib/calendar/track-kind";

/**
 * The three worlds side by side — the reference pattern for "color is never
 * the only signal" (see docs/design-system.md). Icon and label come from
 * `track-styles.ts` rather than being restated here, so a change there can't
 * leave the styleguide showing something the app doesn't.
 *
 * Every class is spelled out in full: Tailwind scans source text, so a class
 * assembled by interpolation (`${text}/80`) would simply never be generated.
 */
interface TrackSample {
  title: string;
  description: string;
  card: string;
  text: string;
  badge: string;
  muted: string;
}

const SAMPLES: Record<TrackKind, TrackSample> = {
  work: {
    title: "Ship the auth flow",
    description: "Due today · Project: Keystroke Hub",
    card: "border-track-work-border bg-track-work",
    text: "text-track-work-foreground",
    badge: "border-track-work-border text-track-work-foreground",
    muted: "text-track-work-foreground/80",
  },
  content: {
    title: 'Script: "Why I rebuilt my dashboard"',
    description: "Draft · Video schedule",
    card: "border-track-content-border bg-track-content",
    text: "text-track-content-foreground",
    badge: "border-track-content-border text-track-content-foreground",
    muted: "text-track-content-foreground/80",
  },
  stream: {
    title: "Friday night ranked run",
    description: "Live 20:00 · Checklist 3/5",
    card: "border-track-stream-border bg-track-stream",
    text: "text-track-stream-foreground",
    badge: "border-track-stream-border text-track-stream-foreground",
    muted: "text-track-stream-foreground/80",
  },
};

export function TrackShowcase() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {TRACK_KINDS.map((track) => {
        const Icon = TRACK_ICON[track];
        const sample = SAMPLES[track];

        return (
          <Card key={track} className={sample.card}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Icon aria-hidden className={cn("size-4", sample.text)} />
                <Badge variant="outline" className={sample.badge}>
                  {TRACK_LABEL[track]}
                </Badge>
              </div>
              <CardTitle className={sample.text}>{sample.title}</CardTitle>
              <CardDescription className={sample.muted}>
                {sample.description}
              </CardDescription>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}
