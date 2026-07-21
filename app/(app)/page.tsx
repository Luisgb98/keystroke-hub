import type { Metadata } from "next";

import { UpcomingAgenda } from "@/components/agenda/upcoming-agenda";
import { ContentSnapshotCard } from "@/components/dashboard/content-snapshot-card";
import { LogStatusCard } from "@/components/dashboard/log-status-card";
import { formatDayLabel, todayParam } from "@/lib/journal/dates";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * The "Today" home screen (issue #28) — a thin composition layer over three
 * self-fetching blocks, each following `UpcomingAgenda`'s resilience
 * contract (a DB failure renders that block's own empty state rather than
 * breaking the page). Mobile-first DOM order — agenda, then log CTA, then
 * content snapshot — matches the two-column desktop grid below (agenda in
 * its own column; log + content stacked in the other) without needing
 * separate layout code paths.
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-10 sm:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">Dashboard</h1>
        <p className="font-mono text-small text-muted-foreground">
          {formatDayLabel(todayParam())}
        </p>
      </div>
      <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start">
        <UpcomingAgenda maxItems={5} />
        <div className="flex flex-col gap-6">
          <LogStatusCard />
          <ContentSnapshotCard />
        </div>
      </div>
    </div>
  );
}
