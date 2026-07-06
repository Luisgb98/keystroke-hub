import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import { PlaceholderPanel } from "@/components/shell/placeholder-panel";

export const metadata: Metadata = {
  title: "Calendar",
};

export default function CalendarPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">Calendar</h1>
        <p className="text-small text-muted-foreground">
          Work and content events, side by side, on one shared calendar.
        </p>
      </div>
      <PlaceholderPanel icon={CalendarDays} />
    </div>
  );
}
