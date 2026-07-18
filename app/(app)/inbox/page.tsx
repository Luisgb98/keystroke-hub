import type { Metadata } from "next";
import { Inbox as InboxIcon } from "lucide-react";

import { EntryCard } from "@/components/inbox/entry-card";
import { Badge } from "@/components/ui/badge";
import { getUntriagedEntries, type UntriagedEntry } from "@/lib/inbox/queries";
import { todayParam } from "@/lib/journal/dates";

export const metadata: Metadata = {
  title: "Inbox",
};

export default async function InboxPage() {
  // Renders even if the database is unreachable — same resilience contract as
  // /projects and /improvements (see docs/database.md).
  let entries: UntriagedEntry[] = [];
  try {
    entries = await getUntriagedEntries();
  } catch (error) {
    console.error("Failed to load the inbox:", error);
  }

  const today = todayParam();

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:mx-auto sm:w-full sm:max-w-2xl sm:px-10 sm:py-8">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-h1 font-semibold">Inbox</h1>
          {entries.length > 0 ? (
            <Badge
              variant="secondary"
              aria-label={`${entries.length} to triage`}
            >
              {entries.length}
            </Badge>
          ) : null}
        </div>
        <p className="text-small text-muted-foreground">
          Everything you captured, waiting to be filed. Triage each thought into
          a content idea, an improvement, today&rsquo;s log, or a meeting note —
          or discard it.
        </p>
      </div>

      {entries.length === 0 ? (
        <div
          data-slot="inbox-empty"
          className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center"
        >
          <InboxIcon aria-hidden className="size-8 text-muted-foreground" />
          <p className="text-small text-muted-foreground">
            Inbox zero. Capture a thought with the button in the corner and it
            lands here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <EntryCard
                id={entry.id}
                body={entry.body}
                createdAt={entry.createdAt}
                today={today}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
