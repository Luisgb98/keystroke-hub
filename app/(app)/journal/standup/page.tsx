import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StandupView } from "@/components/journal/standup-view";
import { Button } from "@/components/ui/button";
import { getStandupView } from "@/lib/data/daily-logs";
import { todayParam } from "@/lib/journal/dates";
import type { StandupView as StandupViewData } from "@/lib/journal/standup";

export const metadata: Metadata = {
  title: "Standup",
};

export default async function StandupPage() {
  const today = todayParam();

  // Same DB-unreachable resilience contract as the day view (see
  // docs/database.md) — an empty standup is a valid render, not a crash.
  let view: StandupViewData = {
    yesterday: null,
    today: { date: today, items: [], isEmpty: true },
  };
  try {
    view = await getStandupView(today);
  } catch (error) {
    console.error("Failed to load the standup view:", error);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:mx-auto sm:w-full sm:max-w-2xl sm:px-10 sm:py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-h1 font-semibold">Standup</h1>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/journal" />}
        >
          <ArrowLeft aria-hidden />
          Journal
        </Button>
      </div>
      <StandupView view={view} />
    </div>
  );
}
