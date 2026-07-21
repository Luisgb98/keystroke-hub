import type { Metadata } from "next";

import { AgendaTabs } from "@/components/improvements/agenda-tabs";
import { ImprovementCapture } from "@/components/improvements/improvement-capture";
import {
  listImprovements,
  listLinkableProjects,
  type ImprovementsOverview,
  type LinkableProjectOption,
} from "@/lib/data/improvements";

export const metadata: Metadata = {
  title: "Improvements backlog",
};

export default async function ImprovementsPage() {
  // Renders even if the database is unreachable — same resilience contract
  // as /projects (see docs/database.md).
  let overview: ImprovementsOverview = { agenda: [], all: [] };
  let projects: LinkableProjectOption[] = [];
  try {
    [overview, projects] = await Promise.all([
      listImprovements(),
      listLinkableProjects(),
    ]);
  } catch (error) {
    console.error("Failed to load improvements:", error);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">
          Improvements backlog
        </h1>
        <p className="text-small text-muted-foreground">
          A running list of process and tooling ideas — capture them here so
          retro and improvement meetings start with a ready agenda.
        </p>
      </div>

      <ImprovementCapture projects={projects} />

      <AgendaTabs overview={overview} />
    </div>
  );
}
