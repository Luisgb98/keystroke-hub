import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StreamChecklist } from "@/components/content/streams/stream-checklist";
import { StreamDetailHeader } from "@/components/content/streams/stream-detail-header";
import { StreamDetailsForm } from "@/components/content/streams/stream-details-form";
import { StreamEventSection } from "@/components/content/streams/stream-event-section";
import { StreamRetroNotes } from "@/components/content/streams/stream-retro-notes";
import { getStreamWithChecklist } from "@/lib/data/streams";

export const metadata: Metadata = {
  title: "Stream",
};

interface StreamDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function StreamDetailPage({
  params,
}: StreamDetailPageProps) {
  const { id } = await params;
  const result = await getStreamWithChecklist(id);
  if (!result) notFound();

  const { stream, event, checklist } = result;
  // "Past" is after the event's start time, not end-of-day (see
  // docs/content-streams.md) — retro notes are always editable but only
  // visually promoted once the stream has actually happened.
  const isPast = Boolean(
    event && event.startsAt.getTime() <= new Date().getTime()
  );

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:mx-auto sm:w-full sm:max-w-2xl sm:px-10 sm:py-8">
      <StreamDetailHeader stream={stream} />

      <StreamDetailsForm stream={stream} />

      <StreamEventSection streamId={stream.id} event={event} />

      <section className="flex flex-col gap-2">
        <h2 className="text-small font-semibold">Pre-stream checklist</h2>
        <StreamChecklist streamId={stream.id} items={checklist} />
      </section>

      <section
        className={
          isPast
            ? "flex flex-col gap-2 rounded-lg border border-track-content-border bg-track-content/40 p-3"
            : "flex flex-col gap-2"
        }
      >
        <h2 className="text-small font-semibold">Post-stream notes</h2>
        <StreamRetroNotes streamId={stream.id} retroNotes={stream.retroNotes} />
      </section>
    </div>
  );
}
