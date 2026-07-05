"use client";

import { useEffect, useRef, useState } from "react";

export function TokenSwatch({
  name,
  cssVar,
  scope,
}: {
  name: string;
  cssVar: string;
  /** Force-preview a theme regardless of the active one, by scoping under `.dark`. */
  scope?: "light" | "dark";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const value = getComputedStyle(ref.current)
      .getPropertyValue(`--${cssVar}`)
      .trim();
    setResolved(value);
  }, [cssVar, scope]);

  return (
    <div className={scope === "dark" ? "dark" : undefined}>
      <div className="flex flex-col gap-1.5">
        <div
          ref={ref}
          className="h-14 w-full rounded-lg ring-1 ring-border"
          style={{ background: `var(--${cssVar})` }}
        />
        <div className="flex flex-col">
          <span className="text-small font-medium">{name}</span>
          <span className="font-mono text-caption text-muted-foreground">
            --{cssVar}
            {resolved ? ` · ${resolved}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
