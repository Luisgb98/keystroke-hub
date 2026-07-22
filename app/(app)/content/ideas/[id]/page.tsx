import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { IdeaDetail } from "@/components/content/detail/idea-detail";
import { getScheduledEventsForIdeas } from "@/lib/data/idea-event-links";
import { getProjectSummariesForIdeas } from "@/lib/data/projects";
import { getIdeaWithScript } from "@/lib/data/scripts";

export const metadata: Metadata = {
  title: "Idea",
};

interface IdeaDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function IdeaDetailPage({ params }: IdeaDetailPageProps) {
  const { id } = await params;

  const result = await getIdeaWithScript(id);
  if (!result) notFound();

  // Same batch loaders the ideas list uses, called with this one id — the
  // linked calendar events (release included) and the project chip.
  const [scheduledEventsByIdea, projectByIdea] = await Promise.all([
    getScheduledEventsForIdeas([id]),
    getProjectSummariesForIdeas([id]),
  ]);

  return (
    <IdeaDetail
      idea={result.idea}
      script={result.script}
      scheduledEvents={scheduledEventsByIdea.get(id) ?? []}
      project={projectByIdea.get(id)}
    />
  );
}
