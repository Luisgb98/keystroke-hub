import { Radio, Shuffle, Video, type LucideIcon } from "lucide-react";

import type { IdeaFormat } from "@/lib/content/idea-format";

/** Icon + label for an idea's format — color is never the only signal (see docs/content-ideas.md). */
export const IDEA_FORMAT_ICON: Record<IdeaFormat, LucideIcon> = {
  video: Video,
  stream: Radio,
  either: Shuffle,
};
