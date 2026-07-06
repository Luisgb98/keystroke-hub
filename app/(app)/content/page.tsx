import type { Metadata } from "next";
import { Clapperboard } from "lucide-react";

import { PlaceholderPanel } from "@/components/shell/placeholder-panel";

export const metadata: Metadata = {
  title: "Content",
};

export default function ContentPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">Content</h1>
        <p className="text-small text-muted-foreground">
          Video ideas, scripts, and your streaming schedule.
        </p>
      </div>
      <PlaceholderPanel icon={Clapperboard} />
    </div>
  );
}
