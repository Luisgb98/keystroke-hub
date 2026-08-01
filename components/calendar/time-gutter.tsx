import { HOURS_IN_DAY } from "@/lib/calendar/constants";
import { formatHourLabel } from "@/lib/time";

/**
 * Hour labels running down the left edge of the day/week time grid. Each row
 * is `h-16` (4rem), matching `HOUR_HEIGHT_REM` used to position event blocks
 * in `DayColumn`, so labels line up with the hour gridlines.
 */
export function TimeGutter() {
  return (
    <div className="w-12 shrink-0 sm:w-14">
      {Array.from({ length: HOURS_IN_DAY }, (_, hour) => (
        <div key={hour} className="h-16">
          <span className="block -translate-y-1/2 pr-2 text-right font-mono text-caption text-muted-foreground">
            {formatHourLabel(hour)}
          </span>
        </div>
      ))}
    </div>
  );
}
