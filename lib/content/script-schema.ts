import { z } from "zod";

// Comfortably above any real script; guards against a runaway paste turning
// into a megabyte row (see docs/scripts.md).
const MAX_CONTENT_LENGTH = 200_000;

export interface ScriptSaveInput {
  ideaId: string;
  content: string;
}

/** Shared by `saveScript`: the id names the idea, not the script (scripts don't have a client-facing id — see docs/scripts.md). */
export const scriptSaveSchema = z.object({
  ideaId: z.string().min(1),
  content: z
    .string()
    .max(
      MAX_CONTENT_LENGTH,
      "That script is too long — keep it under 200,000 characters."
    ),
});
