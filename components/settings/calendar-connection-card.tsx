"use client";

import { useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import {
  TRACK_ICON,
  TRACK_LABEL,
  TRACK_SURFACE_CLASSES,
} from "@/components/calendar/track-styles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Track } from "@/lib/calendar/types";
import type { CalendarConnection } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { disconnectCalendar, startConnect, syncNow } from "@/lib/sync/actions";

interface CalendarConnectionCardProps {
  track: Track;
  connection: CalendarConnection | null;
}

const STATUS_BADGE_VARIANT: Record<
  CalendarConnection["status"],
  "secondary" | "destructive"
> = {
  active: "secondary",
  error: "destructive",
  disconnected: "destructive",
};

const STATUS_LABEL: Record<CalendarConnection["status"], string> = {
  active: "Connected",
  error: "Sync error",
  disconnected: "Disconnected",
};

export function CalendarConnectionCard({
  track,
  connection,
}: CalendarConnectionCardProps) {
  const [pending, startTransition] = useTransition();
  const Icon = TRACK_ICON[track];

  function handleDisconnect() {
    startTransition(async () => {
      const result = await disconnectCalendar(track);
      if (result.error) toast.error(result.error);
      else toast.success(`${TRACK_LABEL[track]} calendar disconnected`);
    });
  }

  function handleSyncNow() {
    startTransition(async () => {
      const result = await syncNow(track);
      if (result.error) toast.error(result.error);
      else toast.success(`${TRACK_LABEL[track]} calendar synced`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full border",
              TRACK_SURFACE_CLASSES[track]
            )}
          >
            <Icon aria-hidden className="size-4" />
          </span>
          {TRACK_LABEL[track]}
        </CardTitle>
        <CardDescription>
          {connection ? connection.googleAccountEmail : "No calendar connected"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {connection ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_BADGE_VARIANT[connection.status]}>
                {STATUS_LABEL[connection.status]}
              </Badge>
              <span className="text-caption text-muted-foreground">
                {connection.lastSyncedAt
                  ? `Synced ${formatDistanceToNow(connection.lastSyncedAt, { addSuffix: true })}`
                  : "Not synced yet"}
              </span>
            </div>
            {connection.status === "error" && connection.lastError ? (
              <p role="alert" className="text-caption text-destructive">
                {connection.lastError}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-small text-muted-foreground">
            Connect a Google Calendar to sync {TRACK_LABEL[track].toLowerCase()}{" "}
            events both ways.
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {connection ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={handleSyncNow}
            >
              Sync now
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </>
        ) : (
          <form action={startConnect.bind(null, track)}>
            <Button type="submit" size="sm">
              Connect
            </Button>
          </form>
        )}
      </CardFooter>
    </Card>
  );
}
