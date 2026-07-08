import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ScriptEditor } from "@/components/content/script/script-editor";
import { getIdeaWithScript } from "@/lib/data/scripts";

export const metadata: Metadata = {
  title: "Script",
};

interface ScriptPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}

export default async function ScriptPage({
  params,
  searchParams,
}: ScriptPageProps) {
  const { id } = await params;
  const { view } = await searchParams;

  const result = await getIdeaWithScript(id);
  if (!result) notFound();

  return (
    <ScriptEditor
      idea={result.idea}
      script={result.script}
      initialView={view === "read" ? "read" : "write"}
    />
  );
}
