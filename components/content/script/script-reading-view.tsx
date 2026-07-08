import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

interface ScriptReadingViewProps {
  content: string;
}

/**
 * Fenced code blocks get a `language-*` class from the Markdown AST; inline
 * code never does — that's the only signal `react-markdown` v10 gives the
 * `code` renderer for telling the two apart (see docs/scripts.md).
 */
const components: Components = {
  h1: ({ className, ...props }) => (
    <h1
      className={cn("font-heading text-h1 font-semibold", className)}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn("mt-2 font-heading text-h2 font-semibold", className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn("mt-2 font-heading text-h3 font-semibold", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("text-body leading-relaxed", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn("list-disc pl-6 text-body leading-relaxed", className)}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn("list-decimal pl-6 text-body leading-relaxed", className)}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "border-l-2 border-track-content-border pl-4 text-body text-muted-foreground italic",
        className
      )}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "text-track-content-foreground underline underline-offset-2",
        className
      )}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("border-border", className)} {...props} />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "overflow-x-auto rounded-lg bg-muted p-3 font-mono text-small",
        className
      )}
      {...props}
    />
  ),
  code: ({ className, ...props }) => {
    const isBlock = /language-/.test(className ?? "");
    return (
      <code
        className={cn(
          "font-mono text-small",
          !isBlock && "rounded bg-muted px-1 py-0.5",
          className
        )}
        {...props}
      />
    );
  },
  table: ({ className, ...props }) => (
    <table
      className={cn("w-full border-collapse text-small", className)}
      {...props}
    />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "border border-border px-2 py-1 text-left font-heading font-semibold",
        className
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn("border border-border px-2 py-1", className)}
      {...props}
    />
  ),
};

/**
 * The showcase surface: design-system typography rather than `prose` (see
 * `docs/scripts.md` — the token scale, not Tailwind Typography's own).
 * Deliberately `text-body` at its default size rather than bumped up further
 * — the *teleprompter-adjacent* framing in the plan is about generous
 * line-height and measure, not literally larger type, so it stays legible
 * at a normal reading distance too.
 */
export function ScriptReadingView({ content }: ScriptReadingViewProps) {
  if (!content.trim()) {
    return (
      <p
        data-slot="script-reading-view"
        className="text-body text-muted-foreground"
      >
        Nothing written yet — switch to Write and start typing.
      </p>
    );
  }

  return (
    <div
      data-slot="script-reading-view"
      className="mx-auto flex w-full max-w-[65ch] flex-col gap-4 pb-24"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
