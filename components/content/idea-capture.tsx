"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { useRegisterDockAction } from "@/components/shell/dock-action-provider";

import { IdeaEditor } from "./idea-editor";

/**
 * The "New idea" primary action for /content/ideas. It owns the create-mode
 * `IdeaEditor` dialog but no longer renders its own floating button — instead
 * it registers the action with the shared capture dock, which renders the
 * single bottom-right FAB (see docs/inbox.md and Issue #74). The form itself
 * lives in `IdeaEditor`, shared with the per-card edit flow (see
 * docs/content-ideas.md).
 */
export function IdeaCapture() {
  const [open, setOpen] = useState(false);
  useRegisterDockAction("New idea", Plus, () => setOpen(true));

  return <IdeaEditor mode="create" open={open} onOpenChange={setOpen} />;
}
