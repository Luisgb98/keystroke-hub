"use client";

import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  attachGithubIssue,
  detachGithubIssue,
  type GithubLinkTarget,
} from "@/lib/github/actions";
import { formatGithubIssueRef } from "@/lib/github/parse";
import type { GithubIssueLinkSummary } from "@/lib/data/github-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { GithubIssueChip } from "./github-issue-chip";

interface GithubIssueLinkSectionProps {
  target: GithubLinkTarget;
  links: GithubIssueLinkSummary[];
  /** Hides the attach input — e.g. an archived project can't take new links. */
  disabled?: boolean;
  /** Tighter spacing for the improvement card's inline surface (see docs/github-links.md). */
  compact?: boolean;
}

/**
 * Attach input + chip list, shared by every host surface (project,
 * improvement, meeting note) instead of a per-entity copy (see
 * docs/github-links.md). No search picker here — attaching is pasting a
 * reference, not choosing from a list.
 */
export function GithubIssueLinkSection({
  target,
  links,
  disabled = false,
  compact = false,
}: GithubIssueLinkSectionProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await attachGithubIssue(target, value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setValue("");
    });
  }

  function handleRemove(link: GithubIssueLinkSummary) {
    startTransition(async () => {
      const result = await detachGithubIssue(link.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const ref = formatGithubIssueRef({
        owner: link.owner,
        repo: link.repo,
        issueNumber: link.issueNumber,
      });
      toast(`${ref} unlinked`, {
        action: {
          label: "Undo",
          onClick: () => {
            startTransition(async () => {
              const undoResult = await attachGithubIssue(target, ref);
              if (undoResult.error) toast.error(undoResult.error);
            });
          },
        },
      });
    });
  }

  return (
    <section
      data-slot="github-issue-link-section"
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-muted/30",
        compact ? "p-2" : "p-3"
      )}
    >
      <h2 className="text-small font-semibold">GitHub issues</h2>

      {!disabled ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-1">
          <div className="flex gap-2">
            <Input
              aria-label="GitHub issue URL or owner/repo#123"
              placeholder="owner/repo#123 or a GitHub issue URL"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              disabled={pending}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={pending || !value.trim()}
            >
              Link issue
            </Button>
          </div>
          {error ? (
            <p className="text-caption text-destructive">{error}</p>
          ) : null}
        </form>
      ) : null}

      {links.length === 0 ? (
        <p className="text-caption text-muted-foreground">
          No GitHub issues linked yet.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {links.map((link) => (
            <li key={link.id} className="max-w-full">
              <GithubIssueChip
                link={link}
                onRemove={disabled ? undefined : () => handleRemove(link)}
                removePending={pending}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
