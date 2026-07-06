import type { Metadata } from "next";
import { NotebookPen } from "lucide-react";

import { PlaceholderPanel } from "@/components/shell/placeholder-panel";

export const metadata: Metadata = {
  title: "Journal",
};

export default function JournalPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">Journal</h1>
        <p className="text-small text-muted-foreground">
          Daily and weekly logs for the work track.
        </p>
      </div>
      <PlaceholderPanel icon={NotebookPen} />
    </div>
  );
}
