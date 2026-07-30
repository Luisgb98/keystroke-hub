"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { requestOpenCapture } from "./inbox-capture-provider";

/**
 * The Inbox page's own capture entry point, added when Issue #85 retired the
 * floating dock. `/inbox` is a server component, so this thin client button
 * pops the shell's shared capture dialog through the global open-capture event
 * rather than owning a dialog of its own (see docs/inbox.md).
 */
export function InboxCaptureButton() {
  return (
    <Button type="button" size="sm" onClick={requestOpenCapture}>
      <Plus aria-hidden />
      Capture a thought
    </Button>
  );
}
