import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Registers the design system's custom font-size scale (app/globals.css `@theme`)
// so twMerge treats `text-caption`/`text-small`/etc. as font-size utilities instead
// of misreading them as conflicting with `text-{color}` utilities.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display", "h1", "h2", "h3", "body", "small", "caption"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
