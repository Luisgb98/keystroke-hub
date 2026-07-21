"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";

export interface LoginState {
  error: string;
}

const loginSchema = z.object({
  password: z.string().min(1),
});

const GENERIC_ERROR = "That password isn't right.";

// Blunts brute-forcing a bit without real rate limiting (see docs/auth.md).
// Overridable so unit tests don't wait out the full second.
function failureDelayMs(): number {
  const raw = process.env.AUTH_FAILURE_DELAY_MS;
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1000;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Only ever redirect within the app — never to an absolute/protocol-relative URL. */
function safeRedirectTarget(from: FormDataEntryValue | null): string {
  if (typeof from !== "string") return "/";
  if (!from.startsWith("/") || from.startsWith("//")) return "/";
  return from;
}

export async function login(
  _prevState: LoginState | undefined,
  formData: FormData
): Promise<LoginState | undefined> {
  const parsed = loginSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter your password." };
  }

  const storedHash = process.env.AUTH_PASSWORD_HASH;
  if (!storedHash) {
    throw new Error(
      "AUTH_PASSWORD_HASH is not set. Generate one with `pnpm auth:hash` — " +
        "see docs/auth.md."
    );
  }

  const valid = await verifyPassword(parsed.data.password, storedHash);
  if (!valid) {
    await sleep(failureDelayMs());
    return { error: GENERIC_ERROR };
  }

  await createSession();
  redirect(safeRedirectTarget(formData.get("from")));
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
