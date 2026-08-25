import { describe, expect, it, vi } from "vitest";

// `next/font/google` fetches and self-hosts fonts at build time — it has no
// runtime implementation to import here, so it's stubbed down to the CSS
// variable the layout actually uses.
vi.mock("next/font/google", () => {
  const font = () => ({ variable: "--stubbed-font" });
  return {
    Bricolage_Grotesque: font,
    Inter: font,
    JetBrains_Mono: font,
  };
});

import {
  APP_BACKGROUND_DARK,
  APP_BACKGROUND_LIGHT,
  APP_NAME,
} from "@/lib/brand";

import { metadata, viewport } from "./layout";

describe("root layout viewport", () => {
  it("opts into the display cutout, which every safe-area inset depends on", () => {
    // Without `viewportFit: "cover"`, `env(safe-area-inset-*)` resolves to 0 on
    // a notched iPhone — so the bottom nav's and the sheet's safe-area padding
    // silently do nothing in standalone mode (#114).
    expect(viewport.viewportFit).toBe("cover");
  });

  it("tints the browser chrome per color scheme", () => {
    expect(viewport.themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: APP_BACKGROUND_LIGHT },
      { media: "(prefers-color-scheme: dark)", color: APP_BACKGROUND_DARK },
    ]);
  });
});

describe("root layout metadata", () => {
  it("declares the Apple web-app tags iOS needs to launch standalone", () => {
    // iOS reads none of the manifest; these are what make an added-to-home-
    // screen copy open without Safari's chrome, under the app's own name.
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      title: APP_NAME,
      statusBarStyle: "default",
    });
  });

  it("points iOS at a real apple-touch-icon", () => {
    expect(metadata.icons).toEqual({ apple: "/apple-touch-icon.png" });
  });

  it("keeps the app's name and description on the document", () => {
    expect(metadata.title).toBe(APP_NAME);
    expect(metadata.description).toEqual(expect.any(String));
  });
});
