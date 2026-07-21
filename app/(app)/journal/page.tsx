import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, ClipboardList } from "lucide-react";

import { DayHeader } from "@/components/journal/day-header";
import { ItemList } from "@/components/journal/item-list";
import { MoodPicker } from "@/components/journal/mood-picker";
import { QuickAdd } from "@/components/journal/quick-add";
import { RetroCard } from "@/components/journal/retro-card";
import { Button } from "@/components/ui/button";
import type { DailyLogItem } from "@/lib/db/schema";
import { getDayLog } from "@/lib/data/daily-logs";
import { parseDateParam, todayParam } from "@/lib/journal/dates";

export const metadata: Metadata = {
  title: "Journal",
};

interface JournalPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function JournalPage({ searchParams }: JournalPageProps) {
  const params = await searchParams;
  const logDate = parseDateParam(params.date);
  const isPastDay = logDate < todayParam();

  // The journal shell should render even if the database is unreachable —
  // e.g. CI's e2e job has no DATABASE_URL (see docs/database.md) but still
  // exercises this page via shell-navigation.spec.ts.
  let items: DailyLogItem[] = [];
  let retro: string | null = null;
  let mood: number | null = null;
  try {
    const dayLog = await getDayLog(logDate);
    items = dayLog.items;
    retro = dayLog.log?.retro ?? null;
    mood = dayLog.log?.mood ?? null;
  } catch (error) {
    console.error("Failed to load the daily log:", error);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:mx-auto sm:w-full sm:max-w-2xl sm:px-10 sm:py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-h1 font-semibold">Journal</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/journal/week" />}
          >
            <CalendarRange aria-hidden />
            Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/journal/standup" />}
          >
            <ClipboardList aria-hidden />
            Standup
          </Button>
        </div>
      </div>

      {/* Keyed by logDate: each subcomponent owns its own local state
          (draft text, optimistic items), which must reset on day navigation
          rather than carry over from the previously-viewed day. */}
      <DayHeader key={`header-${logDate}`} logDate={logDate} />

      {isPastDay ? (
        <p className="text-caption text-muted-foreground">
          Viewing a past day.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <QuickAdd
          key={`plan-${logDate}`}
          logDate={logDate}
          status="planned"
          placeholder="Add a plan…"
          ariaLabel="Add planned item"
        />
        <ItemList key={`items-${logDate}`} logDate={logDate} items={items} />
        <QuickAdd
          key={`done-${logDate}`}
          logDate={logDate}
          status="done"
          placeholder="Log something you did…"
          ariaLabel="Add done item"
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-small font-semibold">Mood</h2>
        <MoodPicker key={`mood-${logDate}`} logDate={logDate} mood={mood} />
      </section>

      <RetroCard key={`retro-${logDate}`} logDate={logDate} retro={retro} />
    </div>
  );
}
