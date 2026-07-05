export interface ColorToken {
  name: string;
  cssVar: string;
  description: string;
}

export const semanticColorTokens: ColorToken[] = [
  { name: "Background", cssVar: "background", description: "Page background" },
  { name: "Foreground", cssVar: "foreground", description: "Default text" },
  { name: "Card", cssVar: "card", description: "Card surface" },
  { name: "Popover", cssVar: "popover", description: "Popover / menu surface" },
  { name: "Primary", cssVar: "primary", description: "Primary actions" },
  { name: "Secondary", cssVar: "secondary", description: "Secondary actions" },
  { name: "Muted", cssVar: "muted", description: "Muted surface" },
  { name: "Accent", cssVar: "accent", description: "Accent surface" },
  {
    name: "Destructive",
    cssVar: "destructive",
    description: "Destructive actions",
  },
  { name: "Border", cssVar: "border", description: "Default border" },
  { name: "Ring", cssVar: "ring", description: "Focus ring" },
];

export const trackColorTokens: {
  track: "work" | "content";
  name: string;
  base: ColorToken;
  foreground: ColorToken;
  border: ColorToken;
}[] = [
  {
    track: "work",
    name: "Work",
    base: { name: "Work surface", cssVar: "track-work", description: "" },
    foreground: {
      name: "Work foreground",
      cssVar: "track-work-foreground",
      description: "",
    },
    border: {
      name: "Work border",
      cssVar: "track-work-border",
      description: "",
    },
  },
  {
    track: "content",
    name: "Content",
    base: { name: "Content surface", cssVar: "track-content", description: "" },
    foreground: {
      name: "Content foreground",
      cssVar: "track-content-foreground",
      description: "",
    },
    border: {
      name: "Content border",
      cssVar: "track-content-border",
      description: "",
    },
  },
];

export interface TypeScaleEntry {
  name: string;
  className: string;
  sample: string;
}

export const typeScale: TypeScaleEntry[] = [
  {
    name: "Display",
    className: "font-heading text-display font-semibold",
    sample: "Keystroke Hub",
  },
  {
    name: "H1",
    className: "font-heading text-h1 font-semibold",
    sample: "One hub, two worlds",
  },
  {
    name: "H2",
    className: "font-heading text-h2 font-semibold",
    sample: "Section heading",
  },
  {
    name: "H3",
    className: "font-heading text-h3 font-semibold",
    sample: "Subsection heading",
  },
  {
    name: "Body",
    className: "text-body",
    sample: "The quick brown fox jumps over the lazy dog.",
  },
  {
    name: "Small",
    className: "text-small",
    sample: "Supporting or secondary text.",
  },
  {
    name: "Caption",
    className: "text-caption text-muted-foreground",
    sample: "Timestamps, labels, metadata.",
  },
];

export const radiusTokens = [
  { name: "sm", className: "rounded-sm" },
  { name: "md", className: "rounded-md" },
  { name: "lg", className: "rounded-lg" },
  { name: "xl", className: "rounded-xl" },
  { name: "2xl", className: "rounded-2xl" },
] as const;

export const shadowTokens = [
  { name: "xs", className: "shadow-xs" },
  { name: "sm", className: "shadow-sm" },
  { name: "md", className: "shadow-md" },
  { name: "lg", className: "shadow-lg" },
] as const;

export const motionTokens = [
  {
    name: "fast",
    cssVar: "--motion-fast",
    durationClass: "duration-motion-fast",
  },
  {
    name: "base",
    cssVar: "--motion-base",
    durationClass: "duration-motion-base",
  },
  {
    name: "slow",
    cssVar: "--motion-slow",
    durationClass: "duration-motion-slow",
  },
] as const;

export const styleguideSections = [
  { id: "colors", label: "Colors" },
  { id: "tracks", label: "Dual-track" },
  { id: "typography", label: "Typography" },
  { id: "spacing-radii", label: "Spacing & radii" },
  { id: "elevation", label: "Elevation" },
  { id: "motion", label: "Motion" },
  { id: "components", label: "Components" },
] as const;
