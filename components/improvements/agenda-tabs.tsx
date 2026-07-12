"use client";

import { useState } from "react";

import type { ImprovementsOverview } from "@/lib/data/improvements";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ImprovementRow } from "./improvement-row";

interface AgendaTabsProps {
  overview: ImprovementsOverview;
}

type View = "agenda" | "all";

/**
 * View switch for `/projects/improvements` — Agenda (not-yet-discussed
 * items, meeting-ready) defaults over All, satisfying the "meeting-ready
 * filtered view" acceptance criterion as a filter on the same list rather
 * than a separate route (see docs/improvements.md). Content is swapped
 * below the `Tabs` control rather than via two `TabsContent` panels — an
 * item on the agenda is also in `all`, and mounting both panels at once
 * would render it twice (same pattern as `ProjectNotes`'s Write/Preview
 * toggle).
 */
export function AgendaTabs({ overview }: AgendaTabsProps) {
  const [view, setView] = useState<View>("agenda");
  const items = view === "agenda" ? overview.agenda : overview.all;

  function handleViewChange(next: unknown) {
    setView(next === "all" ? "all" : "agenda");
  }

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={view} onValueChange={handleViewChange}>
        <TabsList aria-label="Improvements view">
          <TabsTrigger value="agenda">
            Agenda ({overview.agenda.length})
          </TabsTrigger>
          <TabsTrigger value="all">All ({overview.all.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {items.length === 0 ? (
        <p className="py-10 text-center text-small text-muted-foreground">
          {view === "agenda"
            ? "Nothing waiting for the next meeting 🎉"
            : "No improvements yet — add one above to get started."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((improvement) => (
            <ImprovementRow key={improvement.id} improvement={improvement} />
          ))}
        </div>
      )}
    </div>
  );
}
