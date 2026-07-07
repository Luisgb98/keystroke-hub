"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { TRACK_LABEL } from "@/components/calendar/track-styles";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Track } from "@/lib/calendar/types";
import { finishConnect, type CalendarPickerCalendar } from "@/lib/sync/actions";

interface CalendarPickerProps {
  track: Track;
  googleAccountEmail: string;
  calendars: CalendarPickerCalendar[];
}

/**
 * The last step of connecting a track: pick which of the account's Google
 * calendars to sync (open question 5 in the issue #12 plan — the "work
 * calendar" isn't always `primary`). Shown by the settings page while the
 * pending-connection cookie is present (lib/google/oauth.ts).
 */
export function CalendarPicker({
  track,
  googleAccountEmail,
  calendars,
}: CalendarPickerProps) {
  const router = useRouter();
  const primary =
    calendars.find((calendar) => calendar.primary) ?? calendars[0];
  const [calendarId, setCalendarId] = useState(primary?.id ?? "");
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await finishConnect(calendarId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${TRACK_LABEL[track]} calendar connected`);
      router.replace("/settings/calendars");
    });
  }

  if (calendars.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No calendars found</CardTitle>
          <CardDescription>
            {googleAccountEmail} doesn&apos;t have any calendars to connect.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a calendar for {TRACK_LABEL[track]}</CardTitle>
        <CardDescription>Connected as {googleAccountEmail}</CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={calendarId}
          onValueChange={(value) => setCalendarId(value ?? "")}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choose a calendar" />
          </SelectTrigger>
          <SelectContent>
            {calendars.map((calendar) => (
              <SelectItem key={calendar.id} value={calendar.id}>
                {calendar.summary}
                {calendar.primary ? " (primary)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
      <CardFooter className="justify-end">
        <Button disabled={pending || !calendarId} onClick={handleConfirm}>
          {pending ? "Connecting…" : "Use this calendar"}
        </Button>
      </CardFooter>
    </Card>
  );
}
