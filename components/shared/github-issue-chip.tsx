"use client";

import { useTransition } from "react";
import { CircleCheck, CircleDot, CircleHelp, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { refreshGithubIssueLink } from "@/lib/github/actions";
import type { GithubIssueLinkSummary } from "@/lib/data/github-links";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface GithubIssueChipProps {
  link: GithubIssueLinkSummary;
  /** Omit to render read-only (no remove affordance) — e.g. while the host item is archived. */
  onRemove?: () => void;
  removePending?: boolean;
}

const STATE_CONFIG = {
  open: { Icon: CircleDot, label: "Open", className: "text-success" },
  // Closed reuses `--primary` (already a purple hue) rather than adding a
  // second color token for the same meaning (see docs/design-system.md).
  closed: { Icon: CircleCheck, label: "Closed", className: "text-primary" },
} as const;

/**
 * The recognizable GitHub reference: `owner/repo#123`, cached title, and an
 * open/closed state dot — color paired with an icon and a label, never
 * color alone (see docs/design-system.md). Shared by every host surface
 * (project, improvement, meeting note) per docs/github-links.md.
 */
export function GithubIssueChip({
  link,
  onRemove,
  removePending,
}: GithubIssueChipProps) {
  const [refreshing, startRefresh] = useTransition();
  const state = link.state ? STATE_CONFIG[link.state] : null;
  const StateIcon = state?.Icon ?? CircleHelp;
  const ref = `${link.owner}/${link.repo}#${link.issueNumber}`;

  function handleRefresh() {
    startRefresh(async () => {
      const result = await refreshGithubIssueLink(link.id);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <span
      data-slot="github-issue-chip"
      className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background/70 py-1 pr-1 pl-2.5 text-small"
    >
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-1.5 hover:underline"
      >
        <StateIcon
          aria-hidden
          className={cn(
            "size-3.5 shrink-0",
            state?.className ?? "text-muted-foreground"
          )}
        />
        <span className="font-mono text-caption text-muted-foreground">
          {ref}
        </span>
        {link.title ? (
          <Tooltip>
            <TooltipTrigger render={<span className="max-w-40 truncate" />}>
              {link.title}
            </TooltipTrigger>
            <TooltipContent>{link.title}</TooltipContent>
          </Tooltip>
        ) : null}
        <span className="sr-only">{state ? state.label : "State unknown"}</span>
      </a>

      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={`Refresh state for ${ref}`}
        disabled={refreshing}
        onClick={handleRefresh}
      >
        <RefreshCw
          aria-hidden
          className={cn("size-3", refreshing && "animate-spin")}
        />
      </Button>

      {onRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove link to ${ref}`}
          disabled={removePending}
          onClick={onRemove}
        >
          <X aria-hidden className="size-3" />
        </Button>
      ) : null}
    </span>
  );
}
