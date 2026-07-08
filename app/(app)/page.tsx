import type { Metadata } from "next";

import { UpcomingAgenda } from "@/components/agenda/upcoming-agenda";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">Dashboard</h1>
        <p className="text-small text-muted-foreground">
          Your day at a glance, across both tracks.
        </p>
      </div>
      <UpcomingAgenda className="max-w-md" />
    </div>
  );
}
