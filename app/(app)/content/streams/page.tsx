import type { Metadata } from "next";

import { StreamCard } from "@/components/content/streams/stream-card";
import { StreamCreate } from "@/components/content/streams/stream-create";
import { TemplateEditor } from "@/components/content/streams/template-editor";
import {
  getStreamsOverview,
  getTemplateItems,
  type StreamsOverview,
} from "@/lib/data/streams";
import type { StreamChecklistTemplateItem } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Streams",
};

export default async function StreamsPage() {
  // Renders even if the database is unreachable — same resilience contract
  // as /content/ideas and /calendar (see docs/database.md).
  let overview: StreamsOverview = { upcoming: [], unscheduled: [], past: [] };
  let templateItems: StreamChecklistTemplateItem[] = [];
  try {
    [overview, templateItems] = await Promise.all([
      getStreamsOverview(),
      getTemplateItems(),
    ]);
  } catch (error) {
    console.error("Failed to load streams:", error);
  }

  const isEmpty =
    overview.upcoming.length === 0 &&
    overview.unscheduled.length === 0 &&
    overview.past.length === 0;

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-h1 font-semibold">Streams</h1>
          <p className="text-small text-muted-foreground">
            Plan the topic, prep the checklist, go live calmly.
          </p>
        </div>
        <TemplateEditor items={templateItems} />
      </div>

      {isEmpty ? (
        <p className="py-10 text-center text-small text-muted-foreground">
          No streams planned yet — capture one to get started.
        </p>
      ) : (
        <>
          {overview.upcoming.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-small font-semibold text-muted-foreground">
                Upcoming
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {overview.upcoming.map((stream) => (
                  <StreamCard key={stream.id} stream={stream} />
                ))}
              </div>
            </section>
          ) : null}

          {overview.unscheduled.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-small font-semibold text-muted-foreground">
                Unscheduled
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {overview.unscheduled.map((stream) => (
                  <StreamCard key={stream.id} stream={stream} />
                ))}
              </div>
            </section>
          ) : null}

          {overview.past.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-small font-semibold text-muted-foreground">
                Past
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {overview.past.map((stream) => (
                  <StreamCard key={stream.id} stream={stream} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      <StreamCreate />
    </div>
  );
}
