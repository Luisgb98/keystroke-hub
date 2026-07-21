import { weekSignalSentences, type WeekSignals } from "@/lib/journal/signals";

interface WeeklySignalsProps {
  signals: WeekSignals;
}

/**
 * Quiet, muted-foreground context sentences under the assessment card — never
 * a scorecard. Phrased as observation, not verdict, per the non-punitive
 * framing rules (see docs/journal.md).
 */
export function WeeklySignals({ signals }: WeeklySignalsProps) {
  const sentences = weekSignalSentences(signals);

  return (
    <div data-slot="weekly-signals" className="flex flex-col gap-1">
      {sentences.map((sentence) => (
        <p key={sentence} className="text-small text-muted-foreground">
          {sentence}
        </p>
      ))}
    </div>
  );
}
