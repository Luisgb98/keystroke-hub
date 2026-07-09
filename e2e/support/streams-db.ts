import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { like } from "drizzle-orm";

import { streamChecklistTemplateItems, streams } from "../../lib/db/schema";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — streams e2e tests require it.");
  }
  return drizzle(neon(connectionString));
}

/** Removes every fixture stream row under a given title prefix — checklist items cascade with it. */
export async function clearTestStreams(prefix: string): Promise<void> {
  const db = getTestDb();
  await db.delete(streams).where(like(streams.title, `${prefix}%`));
}

/** Removes every fixture template item under a given label prefix — the template is global, so tests must clean up after themselves. */
export async function clearTestTemplateItems(prefix: string): Promise<void> {
  const db = getTestDb();
  await db
    .delete(streamChecklistTemplateItems)
    .where(like(streamChecklistTemplateItems.label, `${prefix}%`));
}
