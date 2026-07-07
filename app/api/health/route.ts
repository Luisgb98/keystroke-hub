import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    await getDb().execute(sql`SELECT 1`);
    return Response.json({ status: "ok" });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
