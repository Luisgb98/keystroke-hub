import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/** Track-agnostic neutral tokens — callers that need track color wrap this in their own container rather than parameterizing the renderer. */
const markdownComponents: Components = {
  p: ({ className, ...props }) => (
    <p className={cn("text-small leading-relaxed", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn("list-disc pl-5 text-small leading-relaxed", className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn("list-decimal pl-5 text-small leading-relaxed", className)}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn("underline underline-offset-2", className)}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  code: ({ className, ...props }) => (
    <code
      className={cn(
        "rounded bg-muted px-1 py-0.5 font-mono text-small",
        className
      )}
      {...props}
    />
  ),
};

interface MarkdownContentProps {
  content: string;
}

/**
 * Shared react-markdown + remark-gfm renderer — extracted from
 * `ProjectNotes`'s preview tab so meeting notes (#26) can reuse the same
 * styling instead of a second implementation (see docs/projects.md,
 * docs/meetings.md).
 */
export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}
