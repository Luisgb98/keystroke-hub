import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit runs as a standalone CLI, outside Next's runtime, so it needs
// its own env loading.
config({ path: ".env.local" });

// Migrations need the direct (unpooled) connection — Neon's pooled
// (PgBouncer) URL doesn't support the session-level features drizzle-kit
// relies on.
const connectionString = process.env.DATABASE_URL_UNPOOLED;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL_UNPOOLED is not set. Copy .env.example to .env.local and " +
      "fill in your Neon direct connection string."
  );
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
