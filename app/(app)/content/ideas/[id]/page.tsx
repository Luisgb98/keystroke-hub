import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { IdeaDetail } from "@/components/content/detail/idea-detail";
import { getGames } from "@/lib/data/games";
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
  const [scheduledEventsByIdea, projectByIdea, games] = await Promise.all([
    getScheduledEventsForIdeas([id]),
    getProjectSummariesForIdeas([id]),
    // The whole library, not just this idea's game: the edit dialog's picker
    // needs every option, and the chip only needs one lookup out of it (#105).
    getGames(),
  ]);

  return (
    <IdeaDetail
      idea={result.idea}
      script={result.script}
      scheduledEvents={scheduledEventsByIdea.get(id) ?? []}
      project={projectByIdea.get(id)}
      game={games.find((game) => game.id === result.idea.gameId)}
      games={games}
    />
  );
}
