import type { MetadataRoute } from "next";

import {
  APP_BACKGROUND_LIGHT,
  APP_DESCRIPTION,
  APP_NAME,
  APP_SHORT_NAME,
  BRAND_COLOR,
} from "@/lib/brand";

/**
 * The web app manifest — what makes "Add to Home Screen" produce an app rather
 * than a browser-chrome-wrapped bookmark (#114).
 *
 * Served at `/manifest.webmanifest`. It is deliberately reachable without a
 * session: browsers fetch the manifest without credentials, so gating it would
 * make the app uninstallable. `proxy.ts`'s matcher already exempts anything
 * with a file extension, which covers this route and the icon PNGs — and the
 * manifest carries nothing private, just a name and four colors.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // A stable `id` is what keeps an already-installed copy updating in place
    // rather than installing a second app beside it if `start_url` ever moves.
    id: "/",
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The splash screen, and the tile the OS shows while the app boots: the
    // app's own light background under the brand accent. The browser chrome's
    // tint is a separate decision — see `viewport.themeColor` in `layout.tsx`,
    // which follows the active color scheme instead.
    background_color: APP_BACKGROUND_LIGHT,
    theme_color: BRAND_COLOR,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Android crops an icon to whatever shape the launcher uses, so the
      // maskable variant keeps the whole mark inside the middle 80%.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
