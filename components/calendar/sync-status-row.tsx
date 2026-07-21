import { formatDistanceToNow } from "date-fns";
import { AlertCircle } from "lucide-react";

import type { CalendarConnection } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

import { TRACK_ICON, TRACK_LABEL } from "./track-styles";

export interface SyncStatusSummary {
  track: CalendarConnection["track"];
  status: CalendarConnection["status"];
  lastSyncedAt: Date | null;
}

/**
 * Ambient, quiet indicator of each connected track's last sync — ancillary
 * to the primary calendar view, never blocking (docs/google-sync.md).
 * Renders nothing when no track is connected yet.
 */
export function SyncStatusRow({
  connections,
}: {
  connections: SyncStatusSummary[];
}) {
  if (connections.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
      {connections.map(({ track, status, lastSyncedAt }) => {
        const Icon = TRACK_ICON[track];
        const isError = status === "error";
        return (
          <span
            key={track}
            className={cn(
              "flex items-center gap-1",
              isError && "text-destructive"
            )}
          >
            {isError ? (
              <AlertCircle aria-hidden className="size-3" />
            ) : (
              <Icon aria-hidden className="size-3" />
            )}
            {TRACK_LABEL[track]}:{" "}
            {isError
              ? "sync error"
              : lastSyncedAt
                ? `synced ${formatDistanceToNow(lastSyncedAt, { addSuffix: true })}`
                : "not synced yet"}
          </span>
        );
      })}
    </div>
  );
}
