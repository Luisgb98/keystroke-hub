import type { Metadata } from "next";

import { ComponentsGallery } from "@/components/styleguide/components-gallery";
import { DualTrackShowcase } from "@/components/styleguide/dual-track-showcase";
import { SectionNav } from "@/components/styleguide/section-nav";
import { TokenSwatch } from "@/components/styleguide/token-swatch";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  motionTokens,
  radiusTokens,
  semanticColorTokens,
  shadowTokens,
  trackColorTokens,
  typeScale,
} from "@/lib/tokens";

export const metadata: Metadata = {
  title: "Styleguide — Keystroke Hub",
  description:
    "Living reference for Keystroke Hub's design tokens and components.",
};

export default function StyleguidePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 pt-6 sm:px-10">
        <div>
          <h1 className="font-heading text-h1 font-semibold">Styleguide</h1>
          <p className="text-small text-muted-foreground">
            The living reference for Keystroke Hub&apos;s visual language.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <SectionNav />

      <main className="flex flex-col gap-16 px-6 py-10 sm:px-10">
        <section id="colors" className="scroll-mt-20">
          <h2 className="font-heading text-h2 font-semibold">Colors</h2>
          <p className="mt-1 text-small text-muted-foreground">
            Semantic tokens, resolved live from the active theme.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {semanticColorTokens.map((token) => (
              <TokenSwatch
                key={token.cssVar}
                name={token.name}
                cssVar={token.cssVar}
              />
            ))}
          </div>
        </section>

        <section id="tracks" className="scroll-mt-20">
          <h2 className="font-heading text-h2 font-semibold">
            Dual-track palette
          </h2>
          <p className="mt-1 text-small text-muted-foreground">
            Work and content never share a color. Every component rendering
            items from both worlds consumes only these tokens — and pairs color
            with an icon and label, never color alone.
          </p>

          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {trackColorTokens.map((group) => (
              <div key={group.track} className="flex flex-col gap-3">
                <h3 className="font-heading text-h3 font-semibold">
                  {group.name} — light
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <TokenSwatch name="Surface" cssVar={group.base.cssVar} />
                  <TokenSwatch
                    name="Foreground"
                    cssVar={group.foreground.cssVar}
                  />
                  <TokenSwatch name="Border" cssVar={group.border.cssVar} />
                </div>
              </div>
            ))}
            {trackColorTokens.map((group) => (
              <div key={`${group.track}-dark`} className="flex flex-col gap-3">
                <h3 className="font-heading text-h3 font-semibold">
                  {group.name} — dark
                </h3>
                <div className="dark grid grid-cols-3 gap-3 rounded-lg bg-background p-3">
                  <TokenSwatch
                    name="Surface"
                    cssVar={group.base.cssVar}
                    scope="dark"
                  />
                  <TokenSwatch
                    name="Foreground"
                    cssVar={group.foreground.cssVar}
                    scope="dark"
                  />
                  <TokenSwatch
                    name="Border"
                    cssVar={group.border.cssVar}
                    scope="dark"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <DualTrackShowcase />
          </div>
        </section>

        <section id="typography" className="scroll-mt-20">
          <h2 className="font-heading text-h2 font-semibold">Typography</h2>
          <div className="mt-4 flex flex-col gap-4">
            {typeScale.map((entry) => (
              <div
                key={entry.name}
                className="flex flex-col gap-1 border-b pb-4"
              >
                <span className="font-mono text-caption text-muted-foreground">
                  {entry.name}
                </span>
                <p className={entry.className}>{entry.sample}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="spacing-radii" className="scroll-mt-20">
          <h2 className="font-heading text-h2 font-semibold">Radii</h2>
          <div className="mt-4 flex flex-wrap gap-4">
            {radiusTokens.map((token) => (
              <div
                key={token.name}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={`size-16 border border-border bg-muted ${token.className}`}
                />
                <span className="font-mono text-caption text-muted-foreground">
                  {token.name}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section id="elevation" className="scroll-mt-20">
          <h2 className="font-heading text-h2 font-semibold">Elevation</h2>
          <p className="mt-1 text-small text-muted-foreground">
            Dark mode leans on borders and lighter surfaces rather than shadows.
          </p>
          <div className="mt-4 flex flex-wrap gap-6">
            {shadowTokens.map((token) => (
              <div
                key={token.name}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={`size-16 rounded-lg bg-card ring-1 ring-border ${token.className}`}
                />
                <span className="font-mono text-caption text-muted-foreground">
                  {token.name}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section id="motion" className="scroll-mt-20">
          <h2 className="font-heading text-h2 font-semibold">Motion</h2>
          <p className="mt-1 text-small text-muted-foreground">
            Durations collapse to 0ms under prefers-reduced-motion.
          </p>
          <div className="mt-4 flex flex-wrap gap-4">
            {motionTokens.map((token) => (
              <div
                key={token.name}
                className={`size-16 rounded-lg bg-primary transition-transform ${token.durationClass} ease-motion-standard hover:scale-90`}
              />
            ))}
          </div>
        </section>

        <section id="components" className="scroll-mt-20">
          <h2 className="font-heading text-h2 font-semibold">Components</h2>
          <div className="mt-4">
            <ComponentsGallery />
          </div>
        </section>
      </main>
    </div>
  );
}
