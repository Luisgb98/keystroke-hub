import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Pin the process timezone before anything reads a date (issue #95). Node
// caches its TZ on first use, so setting this inside a test body doesn't
// reliably take effect — it has to happen here, at config load.
//
// UTC is deliberately *not* the app's timezone: it's what Vercel and CI run
// in, so every unit test exercises the exact server/app-zone mismatch that
// produced the +2h save shift. Tests assert against absolute instants
// (`…Z`/epoch), never against a re-parse of the same wall-clock string, which
// would pass in every timezone and catch nothing.
process.env.TZ = "UTC";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Vitest isn't a react-server environment, so the package's default
      // export would throw; resolve it to its no-op build instead.
      "server-only": path.resolve(
        __dirname,
        "node_modules/server-only/empty.js"
      ),
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    // ".claude" excludes stray agent worktrees (each a full checkout with its
    // own node_modules) from ever being picked up by the test glob — without
    // this, a leftover worktree's duplicate React copy causes "Invalid hook
    // call" errors when its test files run alongside the real ones.
    exclude: ["node_modules", ".next", "e2e", ".claude"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
