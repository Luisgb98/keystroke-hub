import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { like } from "drizzle-orm";

import { githubIssueLinks } from "../../lib/db/schema";

function getTestDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — GitHub link e2e tests require it."
    );
  }
  return drizzle(neon(connectionString));
}

/**
 * Removes every fixture GitHub link under a given owner prefix. Needed
 * because links to a project/improvement don't cascade away on their own
 * (projects/improvements are archive-only, no delete path) — mirrors
 * `clearTestMeetingNotes` in `meeting-notes-db.ts`.
 */
export async function clearTestGithubIssueLinks(
  ownerPrefix: string
): Promise<void> {
  const db = getTestDb();
  await db
    .delete(githubIssueLinks)
    .where(like(githubIssueLinks.owner, `${ownerPrefix}%`));
}
