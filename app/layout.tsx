import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";

import {
  APP_BACKGROUND_DARK,
  APP_BACKGROUND_LIGHT,
  APP_DESCRIPTION,
  APP_NAME,
} from "@/lib/brand";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const fontDisplay = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const fontBody = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const fontMonoIdentity = JetBrains_Mono({
  variable: "--font-mono-identity",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
  // iOS reads none of the manifest. These three tags are what make an
  // added-to-home-screen copy launch without Safari's chrome, under the app's
  // own name (#114).
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    // "default" keeps the status bar legible over the app's own background in
    // both themes; "black-translucent" would slide the page under it, which
    // this layout isn't drawn for.
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // Without `cover`, `env(safe-area-inset-*)` resolves to 0 on a notched
  // iPhone — which silently voided the bottom nav's safe-area padding for as
  // long as it has been there. Every `env(safe-area-inset-bottom)` in the app
  // depends on this line.
  viewportFit: "cover",
  // The browser chrome and the iOS status bar blend into the page rather than
  // announcing the brand — the accent's turn comes on the splash screen and
  // the launcher tile (see `manifest.ts`).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP_BACKGROUND_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: APP_BACKGROUND_DARK },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMonoIdentity.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
