import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

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
